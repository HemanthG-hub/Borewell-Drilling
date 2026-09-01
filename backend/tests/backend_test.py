"""RigRecall iteration 3 backend tests: Experience DNA, Memory Quality,
Similar Experiences (component breakdown, what worked before, outcome variation),
enriched Conflicts, Situation clustering, PDF/TXT upload, legacy alerts/uploads.
"""
import os
import io
import json
import pytest
import requests

from dotenv import load_dotenv
load_dotenv('/app/frontend/.env')
BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
API = f"{BASE_URL}/api"


# ---------- Experience DNA ----------
class TestExperienceDNA:
    def test_dna_case_001(self):
        r = requests.get(f"{API}/experience-dna/CASE-001", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["case_id"] == "CASE-001"
        steps = body["steps"]
        assert len(steps) == 6
        expected = ["context", "event", "action", "outcome", "lesson", "evidence"]
        assert [s["step"] for s in steps] == expected
        for s in steps:
            assert "label" in s and "content" in s and s["label"]

    def test_dna_not_found(self):
        r = requests.get(f"{API}/experience-dna/NOPE-999", timeout=10)
        assert r.status_code == 404


# ---------- Memory Quality ----------
class TestMemoryQuality:
    def test_memory_quality_shape(self):
        r = requests.get(f"{API}/memory-quality", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["total_experiences"] == 8
        assert "coverage_pct" in d
        assert isinstance(d["knowledge_gaps"], list)


# ---------- Recall Engine upgrade ----------
class TestRecallUpgrade:
    def test_recall_returns_components(self):
        payload = {
            "well_id": "W1", "formation": "Wolfcamp",
            "depth_ft": 11200,
            "symptoms": ["torque_spike", "rop_drop"],
            "params": {"torque_kftlbs": 24.0, "rop_ft_hr": 15.0, "mud_weight_ppg": 11.6},
        }
        r = requests.post(f"{API}/recall", json=payload, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "matches" in d and len(d["matches"]) > 0
        m = d["matches"][0]
        c = m["components"]
        for k in ["event_similarity", "symptom_similarity", "depth_proximity",
                  "formation_similarity", "parameter_similarity", "overall_match", "weights"]:
            assert k in c, f"missing component key {k}"
        assert isinstance(c["weights"], dict)

        assert isinstance(d["what_worked_before"], list)
        if d["what_worked_before"]:
            w = d["what_worked_before"][0]
            for k in ["action", "total_similar_cases", "resolved_count",
                      "not_resolved_count", "evidence_strength", "success_rate_pct"]:
                assert k in w
            assert w["evidence_strength"] in ("Strong", "Moderate", "Limited")

        assert isinstance(d["outcome_variation"], list)
        assert isinstance(d["safety_disclaimer"], str) and len(d["safety_disclaimer"]) > 10


# ---------- Conflicts ----------
class TestConflicts:
    def test_conflicts_enriched(self):
        r = requests.get(f"{API}/conflicts", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        for c in data:
            assert c["impact_level"] in ("HIGH", "MEDIUM", "LOW")
            assert isinstance(c["why_it_matters"], str) and c["why_it_matters"]
            assert c["status"] == "Requires Human Review"


# ---------- Situations ----------
class TestSituations:
    created_rule = None

    def test_seed_low_rule_and_situations(self):
        # Ensure at least one triggered alert exists via low-threshold rule + live loop / upload
        payload = {"name": "TEST_LowTorqueSituation", "metric": "torque_kftlbs",
                   "operator": "gt", "threshold": 1, "severity": "low"}
        r = requests.post(f"{API}/alerts/rules", json=payload, timeout=10)
        assert r.status_code == 200
        TestSituations.created_rule = r.json()["id"]

        # Trigger via an upload
        csv = "depth_ft,rop_ft_hr,torque_kftlbs,mud_weight_ppg\n10000,55,25.0,11.5\n"
        requests.post(f"{API}/uploads",
                      files={"file": ("t.csv", csv, "text/csv")},
                      data={"well_name": "TEST_SW", "formation": "Wolfcamp"},
                      timeout=15)

        r2 = requests.get(f"{API}/alerts/situations", timeout=10)
        assert r2.status_code == 200
        d = r2.json()
        assert "raw_breaches" in d
        assert "situations" in d and isinstance(d["situations"], list)
        assert "combined_situations" in d
        if d["situations"]:
            s = d["situations"][0]
            assert "situation_label" in s
            assert "overall_severity" in s
            assert "peak_value" in s

    def test_cleanup_rule(self):
        if TestSituations.created_rule:
            requests.delete(f"{API}/alerts/rules/{TestSituations.created_rule}", timeout=10)


# ---------- Uploads: PDF/TXT ----------
NARRATIVE_TXT = (
    "Stuck pipe event at 11,200 ft. Torque spike observed. "
    "Root cause: pack-off from shale sloughing. "
    "Action: Circulate with high-vis pill. Resolved after 14 hrs."
)


class TestUploadsPDFTXT:
    def test_upload_txt_narrative(self):
        files = {"file": ("narr.txt", NARRATIVE_TXT, "text/plain")}
        data = {"well_name": "TEST_TXT", "formation": "Shale"}
        r = requests.post(f"{API}/uploads", files=files, data=data, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        c = body["case"]
        assert c["extracted_dna"] is not None
        dna = c["extracted_dna"]
        assert dna["event_type"] == "stuck_pipe"
        assert dna["outcome"] == "resolved"
        assert "torque_spike" in dna["symptoms"]
        pipeline = body["extraction_pipeline"]
        assert isinstance(pipeline, list) and len(pipeline) == 4
        assert pipeline[0]["step"] == "UPLOAD REPORT"

    def test_upload_pdf(self):
        # Build a minimal valid PDF using pypdf on the fly
        try:
            from pypdf import PdfWriter
        except Exception:
            pytest.skip("pypdf not available in test env")
        writer = PdfWriter()
        writer.add_blank_page(width=200, height=200)
        buf = io.BytesIO()
        writer.write(buf)
        buf.seek(0)
        files = {"file": ("sample.pdf", buf.getvalue(), "application/pdf")}
        r = requests.post(f"{API}/uploads", files=files,
                          data={"well_name": "TEST_PDF", "formation": "X"},
                          timeout=20)
        # Blank page produces no extractable text → 400 acceptable, else 200 pipeline check
        if r.status_code == 400:
            assert "No text" in r.text or "PDF" in r.text
        else:
            assert r.status_code == 200
            pipeline = r.json()["extraction_pipeline"]
            assert pipeline[0]["step"] == "UPLOAD REPORT"
            assert len(pipeline) == 4

    def test_upload_reject_unsupported(self):
        files = {"file": ("thing.xyz", b"random", "application/octet-stream")}
        r = requests.post(f"{API}/uploads", files=files, timeout=10)
        assert r.status_code == 400


# ---------- Legacy sanity ----------
class TestLegacy:
    def test_cases_list(self):
        r = requests.get(f"{API}/cases", timeout=10)
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_kpis(self):
        r = requests.get(f"{API}/kpis", timeout=10)
        assert r.status_code == 200
        assert "total_cases" in r.json()

    def test_case_evidence(self):
        r = requests.get(f"{API}/cases/CASE-001/evidence", timeout=10)
        assert r.status_code == 200
