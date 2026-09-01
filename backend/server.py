from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import random
import csv
import io
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import json

from sample_data import WELLS, CASES, EVIDENCE, LIVE_EVENT, build_sensor_trace
from las_parser import parse_las, las_to_case

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

app = FastAPI(title="RigRecall API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ----------------------- Models -----------------------
class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ChatRequest(BaseModel):
    session_id: str
    message: str
    case_context_id: Optional[str] = None


# ----------------------- Similarity -----------------------
# ----------------------- Similarity (component breakdown) -----------------------
def similarity_components(new_event: dict, past_case: dict) -> dict:
    """Return per-component similarity 0-100 plus overall weighted score."""
    comps = {}

    # Event / symptom similarity (0-100): Jaccard on symptoms
    ns = set(new_event.get("symptoms", []))
    ps = set(past_case.get("symptoms", []))
    if ns and ps:
        inter = len(ns & ps)
        union = len(ns | ps)
        comps["event_similarity"] = round(100.0 if inter == len(ns) == len(ps) else 0, 0) if not (union) else round(inter / union * 100, 0)
    else:
        comps["event_similarity"] = 0

    # Symptom similarity — same as event (kept separate to match presentation spec)
    if ns and ps:
        overlap = len(ns & ps)
        comps["symptom_similarity"] = round(overlap / max(len(ns), 1) * 100, 0)
    else:
        comps["symptom_similarity"] = 0

    # Depth proximity 0-100 (exponential falloff)
    nd = new_event.get("depth_ft", 0)
    pd = past_case.get("depth_ft", 0)
    if nd and pd:
        diff = abs(nd - pd)
        comps["depth_proximity"] = round(max(0, 100 - (diff / 30)), 0)  # 3000ft diff -> 0
    else:
        comps["depth_proximity"] = 0

    # Formation similarity
    nf = new_event.get("formation", "") or ""
    pf = past_case.get("formation", "") or ""
    if nf == pf and nf:
        comps["formation_similarity"] = 100
    elif nf.split()[:1] == pf.split()[:1] and nf:
        comps["formation_similarity"] = 60
    else:
        comps["formation_similarity"] = 0

    # Parameter similarity
    np_ = new_event.get("params", {})
    pp = past_case.get("params", {})
    tolerances = [("torque_kftlbs", 6), ("rop_ft_hr", 20), ("mud_weight_ppg", 1.2)]
    ratios = []
    for k, tol in tolerances:
        if k in np_ and k in pp:
            diff = abs(np_[k] - pp[k])
            ratios.append(max(0, 1 - diff / tol))
    comps["parameter_similarity"] = round((sum(ratios) / len(ratios) * 100) if ratios else 0, 0)

    # Overall weighted (weights based on operational relevance)
    weights = {
        "event_similarity": 0.15,
        "symptom_similarity": 0.30,
        "depth_proximity": 0.15,
        "formation_similarity": 0.20,
        "parameter_similarity": 0.20,
    }
    overall = sum(comps[k] * w for k, w in weights.items())
    comps["overall_match"] = round(overall, 0)
    comps["weights"] = {k: int(v * 100) for k, v in weights.items()}
    return comps


def similarity_score(new_event: dict, past_case: dict) -> dict:
    """Legacy wrapper — reasons list + score for existing recall route."""
    comps = similarity_components(new_event, past_case)
    reasons = []
    if comps["formation_similarity"] >= 100:
        reasons.append(f"Same formation: {past_case.get('formation')}")
    elif comps["formation_similarity"] >= 60:
        reasons.append(f"Similar formation family: {past_case.get('formation')}")
    ns = set(new_event.get("symptoms", []))
    ps = set(past_case.get("symptoms", []))
    if ns & ps:
        reasons.append(f"Shared symptoms: {', '.join(sorted(ns & ps))}")
    if comps["depth_proximity"] >= 80:
        reasons.append(f"Depth within tight tolerance")
    elif comps["depth_proximity"] >= 50:
        reasons.append(f"Depth within operational range")
    if comps["parameter_similarity"] >= 60:
        reasons.append(f"Drilling parameters converge")
    return {"score": comps["overall_match"], "reasons": reasons, "components": comps}


# ----------------------- Routes -----------------------
@api_router.get("/")
async def root():
    return {"service": "RigRecall API", "status": "ok"}


@api_router.get("/wells")
async def get_wells():
    return WELLS


@api_router.get("/wells/{well_id}")
async def get_well(well_id: str):
    for w in WELLS:
        if w["id"] == well_id:
            return w
    raise HTTPException(404, "Well not found")


@api_router.get("/cases")
async def get_cases(event_type: Optional[str] = None, well_id: Optional[str] = None):
    result = CASES
    if event_type:
        result = [c for c in result if c["event_type"] == event_type]
    if well_id:
        result = [c for c in result if c["well_id"] == well_id]
    return result


@api_router.get("/cases/{case_id}")
async def get_case(case_id: str):
    for c in CASES:
        if c["id"] == case_id:
            return c
    raise HTTPException(404, "Case not found")


@api_router.get("/cases/{case_id}/sensor-trace")
async def get_sensor_trace(case_id: str):
    for c in CASES:
        if c["id"] == case_id:
            return {"case_id": case_id, "trace": build_sensor_trace(c)}
    raise HTTPException(404, "Case not found")


@api_router.get("/evidence/{evidence_id}")
async def get_evidence(evidence_id: str):
    ev = EVIDENCE.get(evidence_id)
    if not ev:
        raise HTTPException(404, "Evidence not found")
    return ev


@api_router.get("/cases/{case_id}/evidence")
async def get_case_evidence(case_id: str):
    for c in CASES:
        if c["id"] == case_id:
            refs = c.get("evidence_refs", [])
            return [EVIDENCE[r] for r in refs if r in EVIDENCE]
    raise HTTPException(404, "Case not found")


@api_router.get("/conflicts")
async def get_conflicts():
    """Return all evidence records with conflict flags, enriched with impact + why-it-matters."""
    conflicts = []
    IMPACT_RULES = {
        "pit gain": ("HIGH", "Discrepancy in pit gain magnitude affects interpretation of well-control severity and the correct kill weight."),
        "mechanism": ("MEDIUM", "Different mechanism attribution changes remediation strategy (mechanical vs differential sticking)."),
        "spike": ("HIGH", "Signal shape disagreement (spike vs drift) changes urgency and recommended intervention window."),
    }
    def assess(reason: str):
        rl = reason.lower()
        for key, (impact, why) in IMPACT_RULES.items():
            if key in rl:
                return impact, why
        return "MEDIUM", "Conflicting evidence may affect how the event is interpreted downstream."

    for eid, ev in EVIDENCE.items():
        if ev.get("conflict"):
            counter_ev = EVIDENCE.get(ev["conflict"]["with"])
            impact, why = assess(ev["conflict"]["reason"])
            conflicts.append({
                "case_id": ev["case_id"],
                "evidence_a": ev,
                "evidence_b": counter_ev,
                "reason": ev["conflict"]["reason"],
                "impact_level": impact,
                "why_it_matters": why,
                "status": "Requires Human Review",
            })
    return conflicts


@api_router.get("/memory-quality")
async def memory_quality():
    """Organizational memory quality metrics + knowledge gaps."""
    total = len(CASES)
    with_action = sum(1 for c in CASES if c.get("action_taken") and c["action_taken"] != "Pending review")
    with_outcome = sum(1 for c in CASES if c.get("outcome") in ("resolved", "not_resolved", "partially_resolved"))
    with_evidence = sum(1 for c in CASES if c.get("evidence_refs"))
    with_lessons = sum(1 for c in CASES if c.get("lessons"))
    conflicts = sum(1 for e in EVIDENCE.values() if e.get("conflict"))
    action_no_outcome = sum(1 for c in CASES if c.get("action_taken") and c["action_taken"] != "Pending review" and c["outcome"] not in ("resolved", "not_resolved", "partially_resolved"))
    outcome_no_lesson = sum(1 for c in CASES if c["outcome"] == "resolved" and not c.get("lessons"))

    gaps = []
    if action_no_outcome > 0:
        gaps.append({
            "severity": "high",
            "message": f"{action_no_outcome} historical events have documented actions but no recorded outcomes. These experiences cannot be confidently reused for learning."
        })
    if outcome_no_lesson > 0:
        gaps.append({
            "severity": "medium",
            "message": f"{outcome_no_lesson} resolved cases lack a documented lesson. Recovery knowledge is trapped in the event log."
        })
    if conflicts > 0:
        gaps.append({
            "severity": "medium",
            "message": f"{conflicts} evidence pairs contradict each other. Human review required before these experiences can be trusted."
        })

    return {
        "total_experiences": total,
        "with_documented_action": with_action,
        "with_known_outcome": with_outcome,
        "with_evidence": with_evidence,
        "with_lessons": with_lessons,
        "conflicting_records": conflicts,
        "coverage_pct": round((with_action + with_outcome + with_evidence + with_lessons) / (total * 4) * 100, 0) if total else 0,
        "knowledge_gaps": gaps,
    }


@api_router.get("/live-event")
async def get_live_event():
    return LIVE_EVENT


@api_router.post("/recall")
async def recall_similar(event: dict):
    """Given a current drilling event, find top similar past cases with component breakdown."""
    scored = []
    for c in CASES:
        if c["outcome"] == "in_progress":
            continue
        s = similarity_score(event, c)
        if s["score"] > 0:
            scored.append({
                "case": c,
                "similarity": s["score"],
                "reasons": s["reasons"],
                "components": s["components"],
                "what_worked": c["action_taken"],
                "outcome": c["outcome"],
                "time_lost_hrs": c["time_lost_hrs"],
                "cost_impact_usd": c["cost_impact_usd"],
                "lessons": c["lessons"],
            })
    scored.sort(key=lambda x: x["similarity"], reverse=True)
    top = scored[:5]

    # Aggregate actions across matches into "What Worked Before"
    # Extract action families from action_taken text
    def action_family(txt: str) -> str:
        t = (txt or "").lower()
        if "circulat" in t and ("high-vis" in t or "hi-vis" in t or "pill" in t):
            return "High-Vis Pill Circulation"
        if "back-ream" in t or "back ream" in t or "reamed" in t:
            return "Back-Reaming"
        if "chemical spot" in t or "pipe-freeing" in t:
            return "Chemical Spot Treatment"
        if "shut-in" in t or "shut in" in t:
            return "Shut-In & Kill"
        if "lcm" in t or "sweep" in t:
            return "LCM Sweep"
        if "rpm" in t or ("reduced" in t and "wob" in t):
            return "RPM / WOB Adjustment"
        if "wait" in t or "weight" in t or "mw raised" in t or "mw " in t:
            return "Increase Mud Weight"
        return "Other Intervention"

    action_agg = {}
    for match in top:
        fam = action_family(match["what_worked"])
        if fam not in action_agg:
            action_agg[fam] = {"total": 0, "resolved": 0, "not_resolved": 0, "cases": [], "avg_hrs": 0, "avg_cost": 0}
        action_agg[fam]["total"] += 1
        if match["outcome"] == "resolved":
            action_agg[fam]["resolved"] += 1
        else:
            action_agg[fam]["not_resolved"] += 1
        action_agg[fam]["cases"].append({"id": match["case"]["id"], "outcome": match["outcome"]})
        action_agg[fam]["avg_hrs"] += match["time_lost_hrs"]
        action_agg[fam]["avg_cost"] += match["cost_impact_usd"]

    what_worked = []
    for fam, d in action_agg.items():
        n = d["total"]
        strength = "Strong" if n >= 3 else "Moderate" if n == 2 else "Limited"
        what_worked.append({
            "action": fam,
            "total_similar_cases": n,
            "resolved_count": d["resolved"],
            "not_resolved_count": d["not_resolved"],
            "success_rate_pct": round(d["resolved"] / n * 100, 0) if n else 0,
            "evidence_strength": strength,
            "avg_time_lost_hrs": round(d["avg_hrs"] / n, 1),
            "avg_cost_usd": round(d["avg_cost"] / n),
            "cases": d["cases"],
        })
    what_worked.sort(key=lambda x: (x["success_rate_pct"], x["total_similar_cases"]), reverse=True)

    # Detect outcome variation: same action family, different outcomes
    outcome_variation = []
    for w in what_worked:
        if w["resolved_count"] > 0 and w["not_resolved_count"] > 0:
            differentiators = []
            case_ids = [ci["id"] for ci in w["cases"]]
            case_objs = [c for c in CASES if c["id"] in case_ids]
            formations = set(c["formation"] for c in case_objs)
            if len(formations) > 1:
                differentiators.append("Different formation across cases")
            depths = [c["depth_ft"] for c in case_objs]
            if depths and max(depths) - min(depths) > 2000:
                differentiators.append(f"Depth range spans {min(depths)}–{max(depths)} ft")
            symptom_sets = [set(c["symptoms"]) for c in case_objs]
            if len(set(frozenset(s) for s in symptom_sets)) > 1:
                differentiators.append("Different initial symptom patterns")
            params_diff = []
            for k in ["torque_kftlbs", "rop_ft_hr", "mud_weight_ppg"]:
                vals = [c["params"].get(k) for c in case_objs if c["params"].get(k) is not None]
                if vals and max(vals) - min(vals) > 0:
                    params_diff.append(k)
            if params_diff:
                differentiators.append(f"Operational parameters differ ({', '.join(params_diff)})")
            outcome_variation.append({
                "action": w["action"],
                "cases": w["cases"],
                "potential_differentiators": differentiators or ["Unknown - deeper analysis needed"],
            })

    return {
        "matches": top,
        "total_found": len(scored),
        "what_worked_before": what_worked,
        "outcome_variation": outcome_variation,
        "safety_disclaimer": "Historical evidence only. Final operational decisions remain with qualified drilling personnel.",
    }


@api_router.get("/kpis")
async def get_kpis():
    active = len([w for w in WELLS if w["status"] == "drilling"])
    total_cases = len(CASES)
    resolved = len([c for c in CASES if c["outcome"] == "resolved"])
    total_time_lost = sum(c["time_lost_hrs"] for c in CASES)
    total_cost = sum(c["cost_impact_usd"] for c in CASES)
    conflicts = sum(1 for e in EVIDENCE.values() if e.get("conflict"))
    critical = len([c for c in CASES if c["severity"] == "critical"])
    return {
        "active_wells": active,
        "total_wells": len(WELLS),
        "total_cases": total_cases,
        "resolved_cases": resolved,
        "success_rate_pct": round(resolved / total_cases * 100, 1) if total_cases else 0,
        "total_time_lost_hrs": total_time_lost,
        "total_cost_impact_usd": total_cost,
        "conflicts_detected": conflicts,
        "critical_events": critical,
    }


# ---------- AI Chat with Claude Sonnet 5 (streaming) ----------
@api_router.post("/chat")
async def chat(req: ChatRequest):
    from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

    # Build context from cases
    ctx_lines = ["You are a senior drilling engineer AI called RigRecall. You have access to a library of past drilling cases and their outcomes. Reason precisely, cite case IDs (e.g. CASE-001), and always mention measured outcomes (time lost, cost) when recommending actions.", "", "AVAILABLE CASES:"]
    for c in CASES:
        ctx_lines.append(f"- {c['id']} | {c['well_name']} | {c['formation']} @ {c['depth_ft']}ft | {c['event_type']} ({c['severity']}) | Action: {c['action_taken']} | Outcome: {c['outcome']} | Time lost: {c['time_lost_hrs']}h | Cost: ${c['cost_impact_usd']:,} | Lessons: {c['lessons']}")

    if req.case_context_id:
        for c in CASES:
            if c["id"] == req.case_context_id:
                ctx_lines.append(f"\nFOCUSED CASE: {json.dumps(c)}")
                break

    system_msg = "\n".join(ctx_lines)

    llm = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=req.session_id,
        system_message=system_msg,
    ).with_model("anthropic", "claude-sonnet-5")

    # Store user message
    await db.chat_messages.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": req.session_id,
        "role": "user",
        "content": req.message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    async def event_generator():
        assistant_text = ""
        try:
            async for ev in llm.stream_message(UserMessage(text=req.message)):
                if isinstance(ev, TextDelta):
                    assistant_text += ev.content
                    yield f"data: {json.dumps({'type': 'delta', 'content': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            logger.error(f"LLM error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

        # Persist assistant message
        await db.chat_messages.insert_one({
            "id": str(uuid.uuid4()),
            "session_id": req.session_id,
            "role": "assistant",
            "content": assistant_text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@api_router.get("/chat/history/{session_id}")
async def chat_history(session_id: str):
    msgs = await db.chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("timestamp", 1).to_list(500)
    return msgs


# ==================== FEATURE ADDITIONS ====================

# In-memory stores (persisted to Mongo too)
UPLOADED_CASES: List[dict] = []
ALERT_RULES: List[dict] = []
TRIGGERED_ALERTS: List[dict] = []


class AlertRule(BaseModel):
    id: Optional[str] = None
    name: str
    metric: str  # torque_kftlbs | rop_ft_hr | mud_weight_ppg | pit_gain
    operator: str  # gt | lt | gte | lte
    threshold: float
    severity: str = "medium"  # low | medium | high | critical
    channel: str = "in_app"
    active: bool = True
    created_at: Optional[str] = None


def eval_rule(rule: dict, value: float) -> bool:
    op = rule["operator"]
    t = rule["threshold"]
    if op == "gt":
        return value > t
    if op == "gte":
        return value >= t
    if op == "lt":
        return value < t
    if op == "lte":
        return value <= t
    return False


def evaluate_alerts(context: dict):
    """Evaluate all active alert rules against a metric context, append triggered alerts."""
    fired = []
    for rule in ALERT_RULES:
        if not rule.get("active"):
            continue
        val = context.get(rule["metric"])
        if val is None:
            continue
        if eval_rule(rule, val):
            alert = {
                "id": str(uuid.uuid4()),
                "rule_id": rule["id"],
                "rule_name": rule["name"],
                "metric": rule["metric"],
                "value": val,
                "threshold": rule["threshold"],
                "severity": rule["severity"],
                "well_id": context.get("well_id"),
                "well_name": context.get("well_name"),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "read": False,
            }
            TRIGGERED_ALERTS.append(alert)
            fired.append(alert)
    return fired


@api_router.get("/alerts/rules")
async def list_rules():
    return ALERT_RULES


@api_router.post("/alerts/rules")
async def create_rule(rule: AlertRule):
    r = rule.model_dump()
    r["id"] = str(uuid.uuid4())
    r["created_at"] = datetime.now(timezone.utc).isoformat()
    ALERT_RULES.append(r)
    return r


@api_router.delete("/alerts/rules/{rule_id}")
async def delete_rule(rule_id: str):
    global ALERT_RULES
    before = len(ALERT_RULES)
    ALERT_RULES = [r for r in ALERT_RULES if r["id"] != rule_id]
    return {"deleted": before - len(ALERT_RULES)}


@api_router.get("/alerts")
async def list_alerts(unread_only: bool = False):
    alerts = TRIGGERED_ALERTS
    if unread_only:
        alerts = [a for a in alerts if not a["read"]]
    return sorted(alerts, key=lambda a: a["timestamp"], reverse=True)[:100]


@api_router.post("/alerts/{alert_id}/read")
async def mark_read(alert_id: str):
    for a in TRIGGERED_ALERTS:
        if a["id"] == alert_id:
            a["read"] = True
            return a
    raise HTTPException(404, "Alert not found")


@api_router.post("/alerts/clear")
async def clear_alerts():
    TRIGGERED_ALERTS.clear()
    return {"ok": True}


@api_router.get("/alerts/situations")
async def alert_situations():
    """Cluster raw triggered alerts into meaningful operational situations."""
    # Group by metric and severity within a time window per well
    situations = {}
    for a in TRIGGERED_ALERTS:
        key = (a.get("well_id") or "?", a["metric"])
        if key not in situations:
            situations[key] = {
                "well_id": a.get("well_id"),
                "well_name": a.get("well_name"),
                "metric": a["metric"],
                "breach_count": 0,
                "severities": {},
                "first_seen": a["timestamp"],
                "last_seen": a["timestamp"],
                "peak_value": a["value"],
                "threshold": a["threshold"],
            }
        s = situations[key]
        s["breach_count"] += 1
        s["severities"][a["severity"]] = s["severities"].get(a["severity"], 0) + 1
        s["last_seen"] = max(s["last_seen"], a["timestamp"])
        s["first_seen"] = min(s["first_seen"], a["timestamp"])
        if a["metric"] == "rop_ft_hr":
            s["peak_value"] = min(s["peak_value"], a["value"])
        else:
            s["peak_value"] = max(s["peak_value"], a["value"])

    METRIC_LABELS = {
        "torque_kftlbs": "Torque Escalation",
        "rop_ft_hr": "ROP Deterioration",
        "mud_weight_ppg": "Mud Weight Anomaly",
    }

    result = []
    for (well_id, metric), s in situations.items():
        s["situation_label"] = METRIC_LABELS.get(metric, "Operational Anomaly")
        # Highest severity present
        for sev in ["critical", "high", "medium", "low"]:
            if sev in s["severities"]:
                s["overall_severity"] = sev
                break
        else:
            s["overall_severity"] = "low"
        result.append(s)

    # Combined anomaly detection
    wells_with_multi_situations = {}
    for s in result:
        wells_with_multi_situations.setdefault(s["well_id"], []).append(s["situation_label"])
    combined = [
        {"well_id": w, "situation_label": "Combined Operational Anomaly",
         "components": labels, "overall_severity": "high"}
        for w, labels in wells_with_multi_situations.items() if len(labels) > 1
    ]

    return {
        "raw_breaches": len(TRIGGERED_ALERTS),
        "situations": sorted(result, key=lambda x: x["last_seen"], reverse=True),
        "combined_situations": combined,
    }


# ==================== CASE UPLOAD ====================

def _pipeline_summary(filename: str):
    if filename.endswith(".pdf") or filename.endswith(".txt"):
        return [
            {"step": "UPLOAD REPORT", "status": "done", "output": filename},
            {"step": "TEXT EXTRACTION", "status": "done", "output": "narrative text extracted"},
            {"step": "STRUCTURED EXTRACTION", "status": "done", "output": "context/event/action/outcome/lesson parsed"},
            {"step": "EXPERIENCE DNA CREATED", "status": "done", "output": "reusable case record"},
        ]
    return [
        {"step": "UPLOAD FILE", "status": "done", "output": filename},
        {"step": "PARSE SENSOR CURVES", "status": "done", "output": "trace rows"},
        {"step": "ANOMALY SCAN", "status": "done", "output": "symptoms detected"},
        {"step": "CASE CREATED", "status": "done", "output": "ingested"},
    ]


def extract_dna_from_text(text: str, well_name: str, formation: str) -> dict:
    """Rule-based extraction from narrative report text (mud logs, DDR)."""
    import re
    t = text
    tl = text.lower().replace(",", "")

    depth_m = re.search(r"(\d{4,6})\s*(ft|feet)", tl)
    torque_m = re.search(r"torque[^0-9\n]{0,20}(\d+\.?\d*)", tl)
    rop_m = re.search(r"rop[^0-9\n]{0,20}(\d+\.?\d*)", tl)
    mw_m = re.search(r"(?:mw|mud weight)[^0-9\n]{0,20}(\d+\.?\d*)", tl)

    symptoms = []
    for kw, sym in [("torque spike", "torque_spike"), ("rop drop", "rop_drop"),
                    ("stuck", "torque_spike"), ("pack[- ]?off", "pack_off"),
                    ("kick", "flow_increase"), ("pit gain", "pit_gain"),
                    ("connection gas", "connection_gas"), ("loss", "mud_loss"),
                    ("stick.?slip", "stick_slip"), ("overpull", "overpull")]:
        if re.search(kw, tl):
            symptoms.append(sym)
    symptoms = list(dict.fromkeys(symptoms))

    event_type = "stuck_pipe" if "stuck" in tl else "kick" if "kick" in tl else "lost_circulation" if "loss" in tl or "lcm" in tl else "vibration" if "stick" in tl else "unknown"
    severity = "critical" if "critical" in tl or "kick" in tl else "high" if "stuck" in tl or "spike" in tl else "medium"

    action_snippets = []
    for kw in ["circulat", "back-ream", "chemical spot", "shut-in", "lcm", "reduced wob", "increased mw", "kill"]:
        m = re.search(rf"[^.]*{kw}[^.]*\.", t, re.IGNORECASE)
        if m:
            action_snippets.append(m.group(0).strip())
    action_taken = " ".join(action_snippets[:2]) or "Not specified in report"

    outcome = "resolved" if any(w in tl for w in ["resolved", "freed", "restored", "recovered", "killed"]) else ("not_resolved" if any(w in tl for w in ["failed", "unable", "abandoned"]) else "unknown")

    lesson_m = re.search(r"(lesson[^:]{0,20}:.{5,300})", tl, re.IGNORECASE)
    if lesson_m:
        lesson = lesson_m.group(1).strip()
    else:
        cause_m = re.search(r"(?:cause|root cause|caused by)[^.]{5,300}\.", t, re.IGNORECASE)
        lesson = cause_m.group(0).strip() if cause_m else ""

    return {
        "context": {
            "well_name": well_name,
            "formation": formation,
            "depth_ft": int(depth_m.group(1)) if depth_m else 0,
            "conditions_note": f"Extracted from narrative ({len(text)} chars)",
        },
        "event_type": event_type,
        "severity": severity,
        "symptoms": symptoms or ["unspecified"],
        "action_taken": action_taken,
        "outcome": outcome,
        "lesson": lesson,
        "depth_ft": int(depth_m.group(1)) if depth_m else 0,
        "params": {
            "torque_kftlbs": float(torque_m.group(1)) if torque_m else 0,
            "rop_ft_hr": float(rop_m.group(1)) if rop_m else 0,
            "mud_weight_ppg": float(mw_m.group(1)) if mw_m else 0,
        },
        "confidence": 0.6,
    }


@api_router.get("/experience-dna/{case_id}")
async def experience_dna(case_id: str):
    """Return Experience DNA (context → event → action → outcome → lesson → evidence)."""
    case = next((c for c in CASES if c["id"] == case_id), None)
    if not case:
        case = next((c for c in UPLOADED_CASES if c["id"] == case_id), None)
    if not case:
        raise HTTPException(404, "Case not found")

    evidence = [EVIDENCE[r] for r in case.get("evidence_refs", []) if r in EVIDENCE]
    return {
        "case_id": case["id"],
        "steps": [
            {
                "step": "context",
                "label": "CONTEXT",
                "content": {
                    "formation": case["formation"],
                    "depth_ft": case["depth_ft"],
                    "well": case["well_name"],
                    "conditions": f"{', '.join(case['symptoms'])} at {case['depth_ft']:,} ft" if case.get("symptoms") else "Baseline operations",
                    "params": case.get("params", {}),
                },
                "evidence_count": len([e for e in evidence if e["type"] == "sensor"]),
            },
            {
                "step": "event",
                "label": "EVENT / PROBLEM",
                "content": {
                    "event_type": case["event_type"].replace("_", " ").title(),
                    "severity": case["severity"],
                    "symptoms": case["symptoms"],
                },
                "evidence_count": len(evidence),
            },
            {
                "step": "action",
                "label": "ACTION TAKEN",
                "content": {"action": case.get("action_taken") or "Not recorded"},
                "evidence_count": len([e for e in evidence if e["type"] == "daily_report"]),
                "documented": bool(case.get("action_taken") and case["action_taken"] != "Pending review"),
            },
            {
                "step": "outcome",
                "label": "OUTCOME",
                "content": {
                    "outcome": case.get("outcome"),
                    "time_lost_hrs": case.get("time_lost_hrs"),
                    "cost_impact_usd": case.get("cost_impact_usd"),
                },
                "evidence_count": len([e for e in evidence if e["type"] in ("daily_report", "wc_report")]),
                "documented": case.get("outcome") in ("resolved", "not_resolved", "partially_resolved"),
            },
            {
                "step": "lesson",
                "label": "LESSON LEARNED",
                "content": {"lesson": case.get("lessons") or "No lesson documented — knowledge gap"},
                "evidence_count": 1 if case.get("lessons") else 0,
                "documented": bool(case.get("lessons")),
            },
            {
                "step": "evidence",
                "label": "EVIDENCE",
                "content": {"records": evidence},
                "evidence_count": len(evidence),
            },
        ],
    }


@api_router.get("/uploads")
async def list_uploaded():
    return UPLOADED_CASES


@api_router.post("/uploads")
async def upload_case(
    file: UploadFile = File(...),
    well_name: str = Form("Uploaded Well"),
    formation: str = Form("Unknown"),
):
    """Accept LAS, CSV, JSON, PDF, or TXT. Sensor path OR narrative-DNA extraction."""
    raw = await file.read()
    filename = file.filename.lower()

    trace = []
    meta = {}
    extracted_dna = None
    extracted_text = ""

    if filename.endswith(".las"):
        content = raw.decode("utf-8", errors="ignore")
        parsed = parse_las(content)
        case_data = las_to_case(parsed, well_id=f"UPLOAD-{len(UPLOADED_CASES)+1}", well_name=well_name, formation=formation)
        if not case_data:
            raise HTTPException(400, "LAS file has no data rows")
        trace = case_data["trace"]
        meta = case_data

    elif filename.endswith(".csv"):
        content = raw.decode("utf-8", errors="ignore")
        reader = csv.DictReader(io.StringIO(content))
        for row in reader:
            trace.append({
                "depth_ft": float(row.get("depth_ft") or row.get("depth") or 0),
                "rop_ft_hr": float(row.get("rop_ft_hr") or row.get("rop") or 0),
                "torque_kftlbs": float(row.get("torque_kftlbs") or row.get("torque") or 0),
                "mud_weight_ppg": float(row.get("mud_weight_ppg") or row.get("mw") or 0),
            })

    elif filename.endswith(".json"):
        try:
            data = json.loads(raw.decode("utf-8", errors="ignore"))
            trace = data if isinstance(data, list) else data.get("trace", [])
        except Exception as e:
            raise HTTPException(400, f"Bad JSON: {e}")

    elif filename.endswith(".pdf") or filename.endswith(".txt"):
        if filename.endswith(".pdf"):
            try:
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(raw))
                extracted_text = "\n".join((page.extract_text() or "") for page in reader.pages)
            except Exception as e:
                raise HTTPException(400, f"PDF read failed: {e}")
        else:
            extracted_text = raw.decode("utf-8", errors="ignore")
        if not extracted_text.strip():
            raise HTTPException(400, "No text could be extracted")
        extracted_dna = extract_dna_from_text(extracted_text, well_name, formation)
    else:
        raise HTTPException(400, "Supported: .las, .csv, .json, .pdf, .txt")

    if not trace and not extracted_dna:
        raise HTTPException(400, "No data rows or narrative content found")

    if trace:
        max_torque = max((p.get("torque_kftlbs", 0) for p in trace), default=0)
        min_rop = min((p.get("rop_ft_hr", 999) for p in trace if p.get("rop_ft_hr", 0) > 0), default=0)
        event_depth = max(trace, key=lambda p: p.get("torque_kftlbs", 0)).get("depth_ft", 0)
        symptoms = []
        if max_torque > 20:
            symptoms.append("torque_spike")
        if min_rop < 20 and min_rop > 0:
            symptoms.append("rop_drop")
        event_type = meta.get("event_type") or ("stuck_pipe" if len(symptoms) >= 2 else ("vibration" if max_torque > 15 else "normal_drilling"))
        severity = meta.get("severity") or ("high" if max_torque > 22 else "medium" if max_torque > 18 else "low")
    else:
        max_torque = extracted_dna.get("params", {}).get("torque_kftlbs", 0)
        min_rop = extracted_dna.get("params", {}).get("rop_ft_hr", 0)
        event_depth = extracted_dna.get("depth_ft", 0)
        symptoms = extracted_dna.get("symptoms", [])
        event_type = extracted_dna.get("event_type", "unknown")
        severity = extracted_dna.get("severity", "medium")

    case = {
        "id": f"UPLOAD-{str(uuid.uuid4())[:8].upper()}",
        "well_id": f"UPLOAD-{len(UPLOADED_CASES)+1}",
        "well_name": well_name,
        "formation": formation,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "depth_ft": round(event_depth, 0),
        "event_type": event_type,
        "severity": severity,
        "symptoms": symptoms or ["normal"],
        "params": {
            "torque_kftlbs": round(max_torque, 1),
            "rop_ft_hr": round(min_rop, 1),
            "mud_weight_ppg": round(trace[-1].get("mud_weight_ppg", 0) if trace else 0, 2),
            "wob_klbs": 0, "flow_gpm": 0,
        },
        "action_taken": extracted_dna["action_taken"] if extracted_dna else "Pending review",
        "outcome": extracted_dna["outcome"] if extracted_dna else "in_progress",
        "time_lost_hrs": 0,
        "cost_impact_usd": 0,
        "lessons": extracted_dna["lesson"] if extracted_dna else "",
        "evidence_refs": [],
        "trace": trace,
        "extracted_dna": extracted_dna,
        "source_text_preview": (extracted_text[:500] if extracted_text else None),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "filename": file.filename,
        "row_count": len(trace),
    }
    UPLOADED_CASES.append(case)

    fired = evaluate_alerts({
        "torque_kftlbs": max_torque,
        "rop_ft_hr": min_rop,
        "mud_weight_ppg": case["params"]["mud_weight_ppg"],
        "well_id": case["well_id"],
        "well_name": well_name,
    })

    return {"case": case, "alerts_triggered": fired, "extraction_pipeline": _pipeline_summary(filename)}


@api_router.get("/uploads/{case_id}")
async def get_uploaded(case_id: str):
    for c in UPLOADED_CASES:
        if c["id"] == case_id:
            return c
    raise HTTPException(404, "Uploaded case not found")


# ==================== LIVE RIG FEED (WebSocket) ====================

class LiveHub:
    """Broadcasts synthetic live rig telemetry to connected clients."""
    def __init__(self):
        self.clients: List[WebSocket] = []
        self.task = None
        self.state = {"depth_ft": 10000.0, "rop_ft_hr": 40.0, "torque_kftlbs": 19.0, "mud_weight_ppg": 11.6, "flow_gpm": 600.0, "wob_klbs": 29.0}

    async def broadcast_loop(self):
        while True:
            await asyncio.sleep(2.0)
            # Simulate: slow depth increase, occasional torque spike
            self.state["depth_ft"] += random.uniform(0.5, 1.5)
            self.state["rop_ft_hr"] = max(5, self.state["rop_ft_hr"] + random.uniform(-4, 3))
            spike = random.random() < 0.08
            self.state["torque_kftlbs"] = max(8, self.state["torque_kftlbs"] + random.uniform(-1.5, 1.5) + (6 if spike else 0))
            self.state["mud_weight_ppg"] = max(9, self.state["mud_weight_ppg"] + random.uniform(-0.05, 0.05))
            self.state["flow_gpm"] = self.state["flow_gpm"] + random.uniform(-5, 5)
            self.state["wob_klbs"] = max(15, self.state["wob_klbs"] + random.uniform(-1, 1))

            # Round for display
            payload = {
                "well_id": "W-BK-2245",
                "well_name": "Bakken 2245",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "depth_ft": round(self.state["depth_ft"], 1),
                "rop_ft_hr": round(self.state["rop_ft_hr"], 1),
                "torque_kftlbs": round(self.state["torque_kftlbs"], 2),
                "mud_weight_ppg": round(self.state["mud_weight_ppg"], 2),
                "flow_gpm": round(self.state["flow_gpm"], 1),
                "wob_klbs": round(self.state["wob_klbs"], 1),
            }

            # Evaluate rules against live tick
            fired = evaluate_alerts({
                "torque_kftlbs": payload["torque_kftlbs"],
                "rop_ft_hr": payload["rop_ft_hr"],
                "mud_weight_ppg": payload["mud_weight_ppg"],
                "well_id": payload["well_id"],
                "well_name": payload["well_name"],
            })
            payload["alerts_fired"] = fired

            dead = []
            for ws in self.clients:
                try:
                    await ws.send_json(payload)
                except Exception:
                    dead.append(ws)
            for d in dead:
                if d in self.clients:
                    self.clients.remove(d)

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.clients.append(ws)
        if self.task is None or self.task.done():
            self.task = asyncio.create_task(self.broadcast_loop())


hub = LiveHub()


@app.websocket("/api/ws/live")
async def live_feed(ws: WebSocket):
    await hub.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        if ws in hub.clients:
            hub.clients.remove(ws)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
