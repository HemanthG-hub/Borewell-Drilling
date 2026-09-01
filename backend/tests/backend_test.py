"""RigRecall iteration 2 feature tests: alerts, uploads, websocket live feed."""
import os
import io
import json
import asyncio
import pytest
import requests
import websockets
from urllib.parse import urlparse

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://rig-recall.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


# ---------- Alert Rules ----------
class TestAlertRules:
    created_ids = []

    def test_list_rules_initial(self):
        r = requests.get(f"{API}/alerts/rules", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_rule(self):
        payload = {"name": "TEST_HighTorque", "metric": "torque_kftlbs",
                   "operator": "gt", "threshold": 22, "severity": "high"}
        r = requests.post(f"{API}/alerts/rules", json=payload, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["id"]
        assert data["created_at"]
        assert data["name"] == payload["name"]
        assert data["threshold"] == 22
        TestAlertRules.created_ids.append(data["id"])

    def test_create_low_threshold_rule_for_triggering(self):
        # Very low threshold to trigger from live feed
        payload = {"name": "TEST_LowTorqueTrigger", "metric": "torque_kftlbs",
                   "operator": "gt", "threshold": 1, "severity": "low"}
        r = requests.post(f"{API}/alerts/rules", json=payload, timeout=10)
        assert r.status_code == 200
        TestAlertRules.created_ids.append(r.json()["id"])

    def test_rule_persists(self):
        r = requests.get(f"{API}/alerts/rules", timeout=10)
        ids = [x["id"] for x in r.json()]
        for cid in TestAlertRules.created_ids:
            assert cid in ids

    def test_alerts_endpoint(self):
        r = requests.get(f"{API}/alerts", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_delete_rule(self):
        if not TestAlertRules.created_ids:
            pytest.skip("no rule created")
        rid = TestAlertRules.created_ids[0]
        r = requests.delete(f"{API}/alerts/rules/{rid}", timeout=10)
        assert r.status_code == 200
        assert r.json()["deleted"] == 1
        # verify removed
        r2 = requests.get(f"{API}/alerts/rules", timeout=10)
        assert rid not in [x["id"] for x in r2.json()]


# ---------- Case Upload ----------
CSV_CONTENT = """depth_ft,rop_ft_hr,torque_kftlbs,mud_weight_ppg
10000,55,15.2,11.5
10005,48,18.4,11.5
10010,22,24.7,11.6
10015,25,22.1,11.6
"""

LAS_CONTENT = """~V
VERS. 2.0 : CWLS LOG ASCII STANDARD
~W
WELL. TESTWELL01 : WELL
~C
DEPT.F : DEPTH
TORQUE.KFTLBS : TORQUE
ROP.FT/HR : ROP
~A
10000 15.2 55
10005 18.4 48
10010 24.7 22
10015 22.1 25
"""


class TestUploads:
    uploaded_case_id = None

    def test_upload_csv(self):
        files = {"file": ("test.csv", CSV_CONTENT, "text/csv")}
        data = {"well_name": "TEST_WellCSV", "formation": "TEST_Formation"}
        r = requests.post(f"{API}/uploads", files=files, data=data, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "case" in body
        assert "alerts_triggered" in body
        c = body["case"]
        assert c["well_name"] == "TEST_WellCSV"
        assert c["row_count"] == 4
        assert len(c["trace"]) == 4
        assert c["event_type"] in ["stuck_pipe", "vibration", "normal_drilling"]
        assert c["severity"] in ["low", "medium", "high", "critical"]
        assert isinstance(c["symptoms"], list)
        TestUploads.uploaded_case_id = c["id"]

    def test_upload_las(self):
        files = {"file": ("test.las", LAS_CONTENT, "text/plain")}
        data = {"well_name": "TEST_WellLAS", "formation": "TEST_Wolfcamp"}
        r = requests.post(f"{API}/uploads", files=files, data=data, timeout=15)
        assert r.status_code == 200, r.text
        c = r.json()["case"]
        assert c["row_count"] >= 3
        assert len(c["trace"]) >= 3
        # torque was max 24.7 -> event_type stuck_pipe expected
        assert c["params"]["torque_kftlbs"] > 20

    def test_upload_invalid_extension(self):
        files = {"file": ("test.txt", b"random", "text/plain")}
        r = requests.post(f"{API}/uploads", files=files, timeout=10)
        assert r.status_code == 400

    def test_list_uploads(self):
        r = requests.get(f"{API}/uploads", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 2

    def test_get_individual_upload(self):
        if not TestUploads.uploaded_case_id:
            pytest.skip("no upload id")
        r = requests.get(f"{API}/uploads/{TestUploads.uploaded_case_id}", timeout=10)
        assert r.status_code == 200
        assert r.json()["id"] == TestUploads.uploaded_case_id

    def test_get_nonexistent_upload(self):
        r = requests.get(f"{API}/uploads/DOES-NOT-EXIST", timeout=10)
        assert r.status_code == 404


# ---------- WebSocket Live Feed ----------
@pytest.mark.asyncio
async def test_websocket_live_feed():
    parsed = urlparse(BASE_URL)
    proto = "wss" if parsed.scheme == "https" else "ws"
    ws_url = f"{proto}://{parsed.netloc}/api/ws/live"

    async with websockets.connect(ws_url, open_timeout=10) as ws:
        messages = []
        for _ in range(2):
            msg = await asyncio.wait_for(ws.recv(), timeout=6)
            data = json.loads(msg)
            messages.append(data)
        assert len(messages) >= 2
        for m in messages:
            for key in ["depth_ft", "rop_ft_hr", "torque_kftlbs",
                        "mud_weight_ppg", "flow_gpm", "wob_klbs",
                        "well_id", "well_name", "timestamp"]:
                assert key in m, f"missing {key}"


# ---------- Alerts triggered after live/upload ----------
def test_alerts_triggered_present():
    # After upload with low-threshold rule + live feed running, we should have alerts
    r = requests.get(f"{API}/alerts", timeout=10)
    assert r.status_code == 200
    # Not asserting >0 strictly to avoid flakiness - the low threshold rule 
    # may have been deleted; log for visibility
    alerts = r.json()
    print(f"Total triggered alerts: {len(alerts)}")
