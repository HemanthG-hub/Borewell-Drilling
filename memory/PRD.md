# RigRecall - Experience Intelligence Platform

## Positioning
"RigRecall is an AI-powered experience intelligence platform for drilling operations. It converts fragmented historical data and reports into reusable, evidence-backed drilling experiences so engineers can recall similar situations, understand actions taken, compare outcomes, and learn from what happened before."

## Design mandate
FIND SIMILAR EXPERIENCES · UNDERSTAND WHAT HAPPENED · LEARN WHAT WAS TRIED · SEE WHAT WORKED · VERIFY WITH EVIDENCE

## Implementation Timeline

### v1 (2026-02-28) — MVP
Backend endpoints, 6 pages, industrial dark theme, react-leaflet map.

### v2 (2026-09-01) — Feature pack
PDF report, LAS/CSV/JSON upload, alert rules, live rig WebSocket feed.

### v3 (2026-09-01) — SIH refocus
Sectioned sidebar, Experience DNA (signature), Similar Experiences w/ component breakdown, What Worked Before, Outcome Variation, enriched Conflicts, Memory Quality widget + gaps, Alerts→Situations clustering, PDF/TXT ingestion.

### v4 (2026-09-01) — Priority updates
- **P1: Upload feeds Recall** — /api/recall now searches CASES + UPLOADED_CASES. /api/cases and /api/cases/{id} return uploaded cases too. Toast + inline confirmation ("SAVED TO EXPERIENCE MEMORY · NOW SEARCHABLE IN RECALL ENGINE").
- **P2: Presentation Mode** — Fixed "START SIH DEMO" button. 8-step walkthrough with real navigation, spotlight highlights (no fake popups), progress bar, Prev/Next/Exit, step dots, and closing outro with the positioning quote. Deep-linkable via `?demo=1&step=N`.
- **P3: LLM DNA Extraction** — `_llm_extract_dna` primary (Claude Sonnet 5 via Emergent LLM key, configurable via `DNA_EXTRACT_PROVIDER` / `DNA_EXTRACT_MODEL` env). Regex fallback preserved as `_regex_extract_dna`. Strict schema, "Not documented" for missing fields, no invented facts.
- **P4: MongoDB persistence** — Uploaded cases persist to `db.uploaded_cases`; startup rehydrates `UPLOADED_CASES`. DELETE endpoint also purges from Mongo.

## Tech
- FastAPI + Motor + emergentintegrations + FastAPI WebSockets + pypdf
- React 19 + react-router-dom + react-leaflet + recharts + @phosphor-icons/react + jspdf
- Claude Sonnet 5 (via EMERGENT_LLM_KEY) for structured DNA extraction

## Test Reports
- iteration_1: 100% (6 core pages)
- iteration_2: 100% (PDF, upload, alerts, live feed)
- iteration_3: 100% (Experience DNA + SIH refocus)
- iteration_4: 100% (LLM extraction, upload→recall, persistence, Presentation Mode)

## Backlog (post-SIH)
- Migrate `@app.on_event` to FastAPI lifespan context
- Split server.py into routers/extractors/hub modules
- LLM stream_message timeout guard
- Persist alert rules and triggered alerts to Mongo (currently in-memory)
- Multi-worker safety: read UPLOADED_CASES directly from Mongo on demand
