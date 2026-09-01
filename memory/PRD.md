# RigRecall - Drilling Intelligence AI

## Problem Statement
An AI that remembers drilling experiences, understands when the same situation is happening again, knows what was tried before, measures what worked, detects conflicting evidence, and shows the engineer the original proof. Must include graphs to show well locations with realistic sample data.

## User Personas
- **Field Drilling Engineer**: Live event happening, needs to know what worked before
- **Company Man / OIM**: Cross-checks reports vs sensor data during a shift
- **Drilling Superintendent**: Reviews case library and outcomes to improve procedures

## Core Requirements
- Historical drilling case memory + measured outcomes
- Similarity/recall engine
- Original evidence viewer
- Conflict detection between sensor data and human reports
- Well map with global well pin locations
- AI assistant grounded in the case library

## What's Been Implemented

### v1 (2026-02-28) — MVP
- Backend: /api/kpis, /api/wells, /api/cases, /api/cases/{id}, sensor-trace, evidence, /api/conflicts, /api/live-event, POST /api/recall, streaming /api/chat (Claude Sonnet 5), chat history
- Sample data: 10 wells, 8 cases, 17 evidence records with 3 conflicts, 1 live event
- Frontend: 6 pages routed — Dashboard, Case Library, Case Detail, Recall Engine, Evidence Viewer, Conflict Detection, AI Assistant. Industrial dark theme, react-leaflet map, recharts.

### v2 (2026-09-01) — Feature pack
- **PDF Incident Report** on Case Detail — jspdf-generated report with header, KPI grid, hand-drawn sensor chart, evidence timeline, action + lessons, page footer.
- **Case Upload** page — LAS 2.0 / CSV / JSON ingest → auto-detect torque_spike/rop_drop → build case record with sensor trace. Triggers active alert rules on ingest.
- **Alert Rules** — In-app rule builder (metric/operator/threshold/severity). Evaluates against live WebSocket telemetry AND uploads. Triggered alerts feed with severity pills.
- **Live Rig Feed** — WebSocket /api/ws/live streams synthetic 2-second telemetry (Bakken 2245) to a dashboard ticker with delta indicators and danger thresholds.

## Prioritized Backlog

### P1
- Persist UPLOADED_CASES / ALERT_RULES / TRIGGERED_ALERTS to MongoDB (currently in-memory)
- Alert dedup / rate-limiting (persistent breach currently fires every tick)
- Real WITSML feed integration to replace synthetic hub
- SMS/email delivery channels for alerts (Twilio/SendGrid)

### P2
- Include uploaded cases in Recall Engine's memory
- Vector embeddings on lessons_learned for semantic recall
- User accounts + team collaboration
- Comparison view across multiple cases

## Tech
- FastAPI + Motor (MongoDB) + emergentintegrations + FastAPI WebSockets
- React 19 + react-router-dom + react-leaflet + recharts + @phosphor-icons/react + jspdf
- Claude Sonnet 5 via EMERGENT_LLM_KEY

## Tests
- iteration_1: 100% backend + 100% frontend (6 pages)
- iteration_2: 100% backend + 100% frontend (4 new features)
