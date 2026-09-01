# RigRecall - Experience Intelligence Platform

## Positioning
"RigRecall is an AI-powered experience intelligence platform for drilling operations. It converts fragmented historical data and reports into reusable, evidence-backed drilling experiences so engineers can recall similar situations, understand actions taken, compare outcomes, and learn from what happened before."

## Design mandate for the interface
FIND SIMILAR EXPERIENCES · UNDERSTAND WHAT HAPPENED · LEARN WHAT WAS TRIED · SEE WHAT WORKED · VERIFY WITH EVIDENCE

## What's Been Implemented

### v1 (2026-02-28) — MVP
Backend: /api/kpis, /api/wells, /api/cases, /api/evidence, /api/conflicts, /api/recall (basic), /api/chat.
Frontend: 6 routed pages, industrial dark theme, react-leaflet map, recharts.

### v2 (2026-09-01) — Feature pack
PDF Incident Report (jspdf), Case Upload (LAS/CSV/JSON), Alert Rules, Live Rig Feed (WebSocket).

### v3 (2026-09-01) — SIH refocus + Experience DNA (signature innovation)
- **Sectioned Sidebar**: OVERVIEW / EXPERIENCE MEMORY / RECALL INTELLIGENCE / TRUST & EVIDENCE / DATA / MORE
- **Experience DNA** (`/dna` + on every CaseDetail): vertical connected flow with color-coded rails — CONTEXT → EVENT/PROBLEM → ACTION TAKEN → OUTCOME → LESSON LEARNED → EVIDENCE. Each step shows evidence count and flags knowledge gaps.
- **Recall Engine upgrade**: renamed matches to "Similar Experiences". Every match shows a "WHY THIS MATCHES" breakdown with 5 weighted components (Event 15%, Symptom 30%, Depth 15%, Formation 20%, Parameter 20%) plus overall_match. Safety disclaimer front and center.
- **What Worked Before** (`/what-worked`): aggregates action families across similar cases with success_rate, resolved/not_resolved distribution bar, average time+cost, and evidence strength (Strong/Moderate/Limited).
- **Outcome Variation**: same action → different outcomes → potential differentiating factors (formation, depth, symptoms, parameters). Historical observations only, not verified causes.
- **Enriched Conflicts**: per-conflict IMPACT LEVEL, WHY IT MATTERS, STATUS ("Requires Human Review"). Rule-based impact scoring.
- **Organizational Memory Quality** widget on Dashboard: total_experiences, with_documented_action, with_known_outcome, with_evidence, conflicting_records, coverage %, plus surfaced KNOWLEDGE GAPS.
- **Alerts simplification**: raw threshold breaches are clustered into "Meaningful Operational Situations" (Torque Escalation, ROP Deterioration, Combined Operational Anomaly). Story banner: LIVE SIGNAL → SITUATION → RECALL → ACTIONS.
- **PDF/TXT ingestion**: added on top of LAS/CSV/JSON. Extraction pipeline visualization (UPLOAD REPORT → TEXT EXTRACTION → STRUCTURED EXTRACTION → EXPERIENCE DNA). Regex-based DNA extraction from narrative.
- **Positioning strip on Dashboard** and safety disclaimers on every predictive surface.

## Tech
- FastAPI + Motor + emergentintegrations + FastAPI WebSockets + pypdf
- React 19 + react-router-dom + react-leaflet + recharts + @phosphor-icons/react + jspdf
- Claude Sonnet 5 via EMERGENT_LLM_KEY (AI Assistant only — deliberately not the main product)

## Test Reports
- iteration_1: 100% (6 core pages)
- iteration_2: 100% (PDF, upload, alerts, live feed)
- iteration_3: 100% (Experience DNA + all v3 refocus features)

## Backlog (P1 for post-SIH)
- Persist UPLOADED_CASES / ALERT_RULES / TRIGGERED_ALERTS to MongoDB
- Alert dedup: collapse persistent breach into single collapsible thread
- Wire uploaded cases into Recall similarity so every ingest teaches the memory
- Split server.py into routers/similarity/upload/alerts modules
- Use Claude Sonnet 5 for extract_dna_from_text (currently regex-based) when structured DNA quality matters

## Not built (out-of-scope for SIH)
- Multi-agent systems, digital twin, GNN, autonomous drilling recommendations
