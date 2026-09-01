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
def similarity_score(new_event: dict, past_case: dict) -> dict:
    """Simple weighted similarity: formation match + symptom overlap + parameter proximity."""
    score = 0.0
    reasons = []

    # Formation match (25 pts)
    if new_event.get("formation") == past_case.get("formation"):
        score += 25
        reasons.append(f"Same formation: {past_case['formation']}")
    elif new_event.get("formation", "").split()[0] == past_case.get("formation", "").split()[0]:
        score += 12
        reasons.append(f"Similar formation family: {past_case.get('formation')}")

    # Symptom overlap (up to 40 pts)
    ns = set(new_event.get("symptoms", []))
    ps = set(past_case.get("symptoms", []))
    if ns and ps:
        overlap = len(ns & ps)
        pct = overlap / max(len(ns), 1)
        pts = pct * 40
        score += pts
        if overlap:
            reasons.append(f"Shared symptoms ({overlap}): {', '.join(sorted(ns & ps))}")

    # Depth proximity (up to 15 pts)
    nd = new_event.get("depth_ft", 0)
    pd = past_case.get("depth_ft", 0)
    if nd and pd:
        diff = abs(nd - pd)
        if diff < 500:
            score += 15
            reasons.append(f"Depth within 500 ft ({pd} vs {nd})")
        elif diff < 1500:
            score += 8
            reasons.append(f"Depth within 1500 ft")

    # Parameter proximity (up to 20 pts): torque, rop, mud_weight
    np_ = new_event.get("params", {})
    pp = past_case.get("params", {})
    param_hits = 0
    for k, tol in [("torque_kftlbs", 4), ("rop_ft_hr", 15), ("mud_weight_ppg", 0.8)]:
        if k in np_ and k in pp and abs(np_[k] - pp[k]) <= tol:
            param_hits += 1
    if param_hits:
        score += (param_hits / 3) * 20
        reasons.append(f"Drilling parameters within tolerance ({param_hits}/3)")

    return {"score": round(min(score, 100), 1), "reasons": reasons}


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
    """Return all evidence records with conflict flags."""
    conflicts = []
    for eid, ev in EVIDENCE.items():
        if ev.get("conflict"):
            counter_ev = EVIDENCE.get(ev["conflict"]["with"])
            conflicts.append({
                "case_id": ev["case_id"],
                "evidence_a": ev,
                "evidence_b": counter_ev,
                "reason": ev["conflict"]["reason"],
            })
    return conflicts


@api_router.get("/live-event")
async def get_live_event():
    return LIVE_EVENT


@api_router.post("/recall")
async def recall_similar(event: dict):
    """Given a current drilling event, find top similar past cases + measure what worked."""
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
                "what_worked": c["action_taken"],
                "outcome": c["outcome"],
                "time_lost_hrs": c["time_lost_hrs"],
                "cost_impact_usd": c["cost_impact_usd"],
                "lessons": c["lessons"],
            })
    scored.sort(key=lambda x: x["similarity"], reverse=True)

    # Measure what worked: which action had best (lowest time+cost) outcomes across top matches
    top = scored[:5]
    action_scores = {}
    for match in top:
        act = match["what_worked"]
        if act not in action_scores:
            action_scores[act] = {"count": 0, "avg_hrs": 0, "avg_cost": 0, "cases": []}
        action_scores[act]["count"] += 1
        action_scores[act]["avg_hrs"] += match["time_lost_hrs"]
        action_scores[act]["avg_cost"] += match["cost_impact_usd"]
        action_scores[act]["cases"].append(match["case"]["id"])
    for act, data in action_scores.items():
        data["avg_hrs"] = round(data["avg_hrs"] / data["count"], 1)
        data["avg_cost"] = round(data["avg_cost"] / data["count"])

    best_action = None
    if action_scores:
        best_action = min(action_scores.items(), key=lambda x: x[1]["avg_hrs"])
        best_action = {"action": best_action[0], **best_action[1]}

    return {
        "matches": top,
        "total_found": len(scored),
        "recommended_action": best_action,
        "action_analysis": action_scores,
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


# ==================== CASE UPLOAD ====================

@api_router.get("/uploads")
async def list_uploaded():
    return UPLOADED_CASES


@api_router.post("/uploads")
async def upload_case(
    file: UploadFile = File(...),
    well_name: str = Form("Uploaded Well"),
    formation: str = Form("Unknown"),
):
    """Accept LAS or CSV/JSON file, extract sensor trace + auto-detected event."""
    content = (await file.read()).decode("utf-8", errors="ignore")
    filename = file.filename.lower()

    trace = []
    meta = {}

    if filename.endswith(".las"):
        parsed = parse_las(content)
        case_data = las_to_case(parsed, well_id=f"UPLOAD-{len(UPLOADED_CASES)+1}", well_name=well_name, formation=formation)
        if not case_data:
            raise HTTPException(400, "LAS file has no data rows")
        trace = case_data["trace"]
        meta = case_data

    elif filename.endswith(".csv"):
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
            data = json.loads(content)
            trace = data if isinstance(data, list) else data.get("trace", [])
        except Exception as e:
            raise HTTPException(400, f"Bad JSON: {e}")
    else:
        raise HTTPException(400, "Supported: .las, .csv, .json")

    if not trace:
        raise HTTPException(400, "No data rows found")

    # Auto-detect event from trace
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
            "mud_weight_ppg": round(trace[-1].get("mud_weight_ppg", 0), 2),
            "wob_klbs": 0, "flow_gpm": 0,
        },
        "action_taken": "Pending review",
        "outcome": "in_progress",
        "time_lost_hrs": 0,
        "cost_impact_usd": 0,
        "lessons": "",
        "evidence_refs": [],
        "trace": trace,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "filename": file.filename,
        "row_count": len(trace),
    }
    UPLOADED_CASES.append(case)

    # Evaluate alerts on the ingested max metrics
    fired = evaluate_alerts({
        "torque_kftlbs": max_torque,
        "rop_ft_hr": min_rop,
        "mud_weight_ppg": case["params"]["mud_weight_ppg"],
        "well_id": case["well_id"],
        "well_name": well_name,
    })

    return {"case": case, "alerts_triggered": fired}


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
