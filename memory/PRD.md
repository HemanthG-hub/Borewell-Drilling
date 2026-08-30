# RigRecall - Drilling Intelligence AI

## Problem Statement
An AI that remembers drilling experiences, understands when the same situation is happening again, knows what was tried before, measures what worked, detects conflicting evidence, and shows the engineer the original proof. Must include graphs to show well locations with realistic sample data.

## User Personas
- **Field Drilling Engineer**: Live event happening, needs to know what worked before
- **Company Man / OIM**: Cross-checks reports vs sensor data during a shift
- **Drilling Superintendent**: Reviews case library and outcomes to improve procedures

## Core Requirements (static)
- Historical drilling case memory with outcomes (time lost, cost, resolved status)
- Similarity/recall engine — new event → top matching past cases + measured action
- Original evidence viewer (mud logs, sensor traces, daily reports)
- Conflict detection between sensor data and human reports
- Well map with global well pin locations, status color coding
- AI assistant grounded in the case library

## What's been implemented (v1 · 2026-02-28)
- Backend FastAPI at :8001 with endpoints: /api/kpis, /api/wells, /api/cases, /api/cases/{id}, /api/cases/{id}/sensor-trace, /api/cases/{id}/evidence, /api/evidence/{id}, /api/conflicts, /api/live-event, POST /api/recall, POST /api/chat (SSE streaming), GET /api/chat/history/{sid}
- Realistic sample data: 10 wells (Permian, Bakken, Eagle Ford, GoM, North Sea, Ghawar), 8 historical cases, 17 evidence records with conflict flags, 1 live event
- Similarity scoring on formation, symptoms, depth, drilling parameters
- Frontend (React + react-leaflet + recharts + Chivo/JetBrains Mono industrial theme): 6 pages routed
  - Dashboard: KPIs, world map with well markers, recent cases, event distribution chart
  - Case Library: filterable table
  - Case Detail: summary, sensor chart with event reference line, params, action & lessons, evidence
  - Recall Engine: live event card, radar chart, top matches, "measured what worked" recommendation
  - Evidence Viewer: split view (case selector + sensor trace + source documents)
  - Conflict Detection: side-by-side comparison of contradictory evidence
  - AI Assistant: streaming chat via Claude Sonnet 5 (emergent LLM key), suggestion prompts
- Testing agent: 100% backend + 100% frontend pass on iteration 1

## Prioritized Backlog
### P1 (next value adds)
- Upload real WITSML/LAS files → auto-ingest into case library
- Real-time WebSocket for live event ticker (currently static sample)
- Alerting rules (SMS/email when torque signature matches a critical case)
### P2 (nice to have)
- User accounts + team collaboration (case comments, annotations)
- PDF report export for post-incident review
- Vector embeddings on lessons_learned for semantic recall

## Tech
- FastAPI + Motor (MongoDB) + emergentintegrations
- React 19 + react-router-dom + react-leaflet + recharts + @phosphor-icons/react
- Claude Sonnet 5 via EMERGENT_LLM_KEY
