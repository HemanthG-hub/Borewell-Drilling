"""Iteration 4: LLM DNA extraction, upload→recall integration, MongoDB persistence,
DELETE uploads. Uses real backend URL via REACT_APP_BACKEND_URL."""
import os
import time
import pytest
import requests
from dotenv import load_dotenv
load_dotenv('/app/frontend/.env')

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
API = f"{BASE_URL}/api"

NARRATIVE = (
    "Daily Drilling Report - 2024-08-14. Well: Test Rig, Formation: Wolfcamp A, "
    "depth 11200 ft. Event: Stuck pipe. Torque climbed from 14 to 22 kftlbs. "
    "Action taken: Circulated high-vis pill; back-reamed 3 stands. "
    "Outcome: Freed after 14 hrs. Root cause: pack-off. "
    "Lesson: Early torque signature at 11150 ft indicated pack-off risk."
)


@pytest.fixture(scope="module")
def uploaded_case():
    """Upload once, share the resulting case across tests. Cleanup at end."""
    files = {"file": ("ddr_wolfcamp.txt", NARRATIVE, "text/plain")}
    data = {"well_name": "TEST_Rig_LLM", "formation": "Wolfcamp A"}
    r = requests.post(f"{API}/uploads", files=files, data=data, timeout=60)
    assert r.status_code == 200, r.text
    case = r.json()["case"]
    yield case
    # teardown
    try:
        requests.delete(f"{API}/uploads/{case['id']}", timeout=10)
    except Exception:
        pass


class TestLLMExtraction:
    def test_llm_extractor_used(self, uploaded_case):
        dna = uploaded_case["extracted_dna"]
        assert dna is not None, "extracted_dna must be present"
        extractor = dna.get("extractor", "")
        # Should be anthropic:claude-sonnet-5 (not regex_fallback)
        assert extractor.startswith("anthropic:claude-sonnet-5"), (
            f"Expected anthropic:claude-sonnet-5 extractor, got: {extractor}"
        )
        assert dna.get("confidence", 0) >= 0.8

    def test_llm_extracted_fields(self, uploaded_case):
        dna = uploaded_case["extracted_dna"]
        # LLM should pick up action & lesson from narrative
        action = (dna.get("action_taken") or "").lower()
        assert "pill" in action or "ream" in action or "circulat" in action, \
            f"action_taken should reference pill/reaming/circulation, got: {action}"
        lesson = (dna.get("lesson") or "").lower()
        assert "pack" in lesson or "torque" in lesson or "11150" in lesson, \
            f"lesson should mention pack-off / torque signature, got: {lesson}"
        assert dna.get("event_type") == "stuck_pipe"
        assert dna.get("outcome") == "resolved"


class TestPersistence:
    def test_upload_appears_in_uploads_list(self, uploaded_case):
        r = requests.get(f"{API}/uploads", timeout=10)
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        assert uploaded_case["id"] in ids

    def test_upload_appears_in_cases_list(self, uploaded_case):
        # GET /api/cases now includes uploaded
        r = requests.get(f"{API}/cases", timeout=10)
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        assert uploaded_case["id"] in ids, "Uploaded case must appear in /api/cases"

    def test_cases_exclude_uploaded_when_flag_false(self, uploaded_case):
        r = requests.get(f"{API}/cases?include_uploaded=false", timeout=10)
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        assert uploaded_case["id"] not in ids

    def test_get_case_by_id_for_uploaded(self, uploaded_case):
        r = requests.get(f"{API}/cases/{uploaded_case['id']}", timeout=10)
        assert r.status_code == 200
        assert r.json()["id"] == uploaded_case["id"]

    def test_sensor_trace_for_uploaded(self, uploaded_case):
        r = requests.get(f"{API}/cases/{uploaded_case['id']}/sensor-trace", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["case_id"] == uploaded_case["id"]
        assert "trace" in body  # narrative → empty trace ok

    def test_experience_dna_for_uploaded(self, uploaded_case):
        r = requests.get(f"{API}/experience-dna/{uploaded_case['id']}", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["case_id"] == uploaded_case["id"]
        assert len(body["steps"]) == 6

    def test_persistence_in_mongo(self, uploaded_case):
        """Verify case persisted in MongoDB via direct query."""
        try:
            from pymongo import MongoClient
        except ImportError:
            pytest.skip("pymongo not available")
        load_dotenv('/app/backend/.env')
        mongo_url = os.environ['MONGO_URL']
        db_name = os.environ['DB_NAME']
        cli = MongoClient(mongo_url)
        try:
            doc = cli[db_name].uploaded_cases.find_one({"id": uploaded_case["id"]})
            assert doc is not None, "Uploaded case not found in MongoDB"
            assert doc["id"] == uploaded_case["id"]
        finally:
            cli.close()


class TestRecallIntegration:
    def test_uploaded_case_appears_in_recall(self, uploaded_case):
        payload = {
            "well_id": "W-TEST", "formation": "Wolfcamp A",
            "depth_ft": 11200,
            "symptoms": ["torque_spike", "rop_drop"],
            "params": {"torque_kftlbs": 22.0, "rop_ft_hr": 15.0, "mud_weight_ppg": 11.6},
        }
        r = requests.post(f"{API}/recall", json=payload, timeout=20)
        assert r.status_code == 200
        matches = r.json()["matches"]
        assert len(matches) > 0
        # Look for uploaded source or UPLOAD- prefix
        found_uploaded = any(
            m.get("source") == "uploaded" or m["case"]["id"].startswith("UPLOAD-")
            for m in matches
        )
        assert found_uploaded, (
            f"No uploaded case in recall matches. IDs: {[m['case']['id'] for m in matches]}"
        )


class TestDelete:
    def test_delete_uploaded(self):
        # create a fresh one to delete
        files = {"file": ("delme.txt", NARRATIVE, "text/plain")}
        r = requests.post(f"{API}/uploads", files=files,
                          data={"well_name": "TEST_DEL", "formation": "X"}, timeout=120)
        assert r.status_code == 200
        cid = r.json()["case"]["id"]
        d = requests.delete(f"{API}/uploads/{cid}", timeout=10)
        assert d.status_code == 200
        assert d.json().get("deleted") == 1
        # Verify gone from list
        lst = requests.get(f"{API}/uploads", timeout=10).json()
        assert cid not in [c["id"] for c in lst]
        # Verify gone from mongo
        try:
            from pymongo import MongoClient
            load_dotenv('/app/backend/.env')
            cli = MongoClient(os.environ['MONGO_URL'])
            doc = cli[os.environ['DB_NAME']].uploaded_cases.find_one({"id": cid})
            assert doc is None
            cli.close()
        except ImportError:
            pass
