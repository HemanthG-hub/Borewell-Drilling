from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import json

from sample_data import WELLS, CASES, EVIDENCE, LIVE_EVENT, build_sensor_trace

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
