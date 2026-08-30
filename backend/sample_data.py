"""Sample drilling data - realistic oil & gas cases."""
from datetime import datetime, timezone, timedelta
import random

# Real-ish well locations across major oil basins
WELLS = [
    {"id": "W-PB-1042", "name": "Permian Basin 1042", "field": "Midland", "lat": 31.9973, "lng": -102.0779, "status": "drilling", "depth_ft": 12450, "formation": "Wolfcamp A", "operator": "Ranger Oil"},
    {"id": "W-PB-1078", "name": "Permian Basin 1078", "field": "Delaware", "lat": 31.7619, "lng": -103.0850, "status": "drilling", "depth_ft": 9820, "formation": "Bone Spring", "operator": "Ranger Oil"},
    {"id": "W-BK-2201", "name": "Bakken 2201", "field": "Williston", "lat": 47.9253, "lng": -103.4879, "status": "producing", "depth_ft": 10650, "formation": "Middle Bakken", "operator": "Northland E&P"},
    {"id": "W-EF-3310", "name": "Eagle Ford 3310", "field": "Karnes", "lat": 28.8850, "lng": -97.9014, "status": "drilling", "depth_ft": 8500, "formation": "Austin Chalk", "operator": "Ranger Oil"},
    {"id": "W-MC-4472", "name": "GoM MC-4472", "field": "Mississippi Canyon", "lat": 28.4300, "lng": -88.9700, "status": "shut-in", "depth_ft": 18200, "formation": "Miocene", "operator": "DeepBlue Offshore"},
    {"id": "W-NS-5510", "name": "North Sea 5510", "field": "Forties", "lat": 57.7300, "lng": 0.9200, "status": "producing", "depth_ft": 11200, "formation": "Paleocene Sandstone", "operator": "Nordic Petro"},
    {"id": "W-PB-1091", "name": "Permian Basin 1091", "field": "Midland", "lat": 32.1150, "lng": -101.9500, "status": "drilling", "depth_ft": 11890, "formation": "Wolfcamp B", "operator": "Ranger Oil"},
    {"id": "W-BK-2245", "name": "Bakken 2245", "field": "Williston", "lat": 48.1780, "lng": -103.7910, "status": "drilling", "depth_ft": 10120, "formation": "Three Forks", "operator": "Northland E&P"},
    {"id": "W-EF-3355", "name": "Eagle Ford 3355", "field": "DeWitt", "lat": 29.0700, "lng": -97.3500, "status": "producing", "depth_ft": 8100, "formation": "Eagle Ford Lower", "operator": "Ranger Oil"},
    {"id": "W-GH-9911", "name": "Ghawar 9911", "field": "Ghawar", "lat": 25.4295, "lng": 49.6250, "status": "producing", "depth_ft": 7300, "formation": "Arab-D Carbonate", "operator": "Global Petroleum"},
]

# Historical drilling cases - the "memory" of the AI
CASES = [
    {
        "id": "CASE-001", "well_id": "W-PB-1042", "well_name": "Permian Basin 1042",
        "date": "2024-08-14", "formation": "Wolfcamp A", "depth_ft": 11200,
        "event_type": "stuck_pipe", "severity": "high",
        "symptoms": ["torque_spike", "rop_drop", "erratic_standpipe_pressure"],
        "params": {"rop_ft_hr": 32, "wob_klbs": 28, "torque_kftlbs": 22, "mud_weight_ppg": 12.4, "flow_gpm": 620},
        "action_taken": "Circulate with high-vis pill; back-reamed 3 stands; reduced WOB from 32 to 22 klbs",
        "outcome": "resolved", "time_lost_hrs": 14, "cost_impact_usd": 210000,
        "lessons": "Early torque signature at 11,150 ft indicated pack-off risk. Proactive circulation and WOB reduction restored motion within 14 hrs.",
        "evidence_refs": ["mud-log-08-14", "sensor-trace-08-14", "morning-report-08-15"]
    },
    {
        "id": "CASE-002", "well_id": "W-PB-1078", "well_name": "Permian Basin 1078",
        "date": "2024-10-02", "formation": "Bone Spring", "depth_ft": 9450,
        "event_type": "kick", "severity": "critical",
        "symptoms": ["flow_increase", "pit_gain", "connection_gas"],
        "params": {"rop_ft_hr": 78, "wob_klbs": 24, "torque_kftlbs": 16, "mud_weight_ppg": 11.2, "flow_gpm": 580},
        "action_taken": "Shut-in on driller's method; increased MW to 11.9 ppg; circulated influx over 6 hrs",
        "outcome": "resolved", "time_lost_hrs": 9, "cost_impact_usd": 145000,
        "lessons": "Pore pressure ramp underestimated; 0.7 ppg overbalance restored well control.",
        "evidence_refs": ["mud-log-10-02", "sensor-trace-10-02", "well-control-report-10-02"]
    },
    {
        "id": "CASE-003", "well_id": "W-BK-2201", "well_name": "Bakken 2201",
        "date": "2024-06-20", "formation": "Middle Bakken", "depth_ft": 10200,
        "event_type": "stuck_pipe", "severity": "high",
        "symptoms": ["torque_spike", "overpull", "no_rotation"],
        "params": {"rop_ft_hr": 45, "wob_klbs": 30, "torque_kftlbs": 24, "mud_weight_ppg": 11.8, "flow_gpm": 590},
        "action_taken": "Jarring 18 hrs; unable to free; pipe-freeing chemical spot; freed after 26 hrs",
        "outcome": "resolved", "time_lost_hrs": 26, "cost_impact_usd": 410000,
        "lessons": "Delayed intervention. Torque spikes at 10,180 ft should have triggered pill circulation within 30 min.",
        "evidence_refs": ["mud-log-06-20", "sensor-trace-06-20", "morning-report-06-21"]
    },
    {
        "id": "CASE-004", "well_id": "W-EF-3310", "well_name": "Eagle Ford 3310",
        "date": "2024-11-11", "formation": "Austin Chalk", "depth_ft": 7800,
        "event_type": "lost_circulation", "severity": "medium",
        "symptoms": ["mud_loss", "pit_drop", "static_annulus"],
        "params": {"rop_ft_hr": 55, "wob_klbs": 26, "torque_kftlbs": 14, "mud_weight_ppg": 10.6, "flow_gpm": 550},
        "action_taken": "LCM sweep (medium/coarse); reduced ECD; sealed fracture at 7,820 ft",
        "outcome": "resolved", "time_lost_hrs": 8, "cost_impact_usd": 92000,
        "lessons": "Fracture gradient tighter than model. Recommend ECD monitoring below 10.4 ppg equivalent.",
        "evidence_refs": ["mud-log-11-11", "sensor-trace-11-11"]
    },
    {
        "id": "CASE-005", "well_id": "W-MC-4472", "well_name": "GoM MC-4472",
        "date": "2024-03-05", "formation": "Miocene", "depth_ft": 17500,
        "event_type": "kick", "severity": "critical",
        "symptoms": ["flow_increase", "pit_gain", "trip_gas"],
        "params": {"rop_ft_hr": 22, "wob_klbs": 20, "torque_kftlbs": 28, "mud_weight_ppg": 15.8, "flow_gpm": 480},
        "action_taken": "Hard shut-in; wait & weight method; MW raised to 16.4 ppg over 11 hrs",
        "outcome": "resolved", "time_lost_hrs": 18, "cost_impact_usd": 890000,
        "lessons": "Deepwater HPHT. Trip margins were insufficient. Increase safety factor for future connections below 17,000 ft.",
        "evidence_refs": ["mud-log-03-05", "sensor-trace-03-05", "well-control-report-03-05"]
    },
    {
        "id": "CASE-006", "well_id": "W-PB-1091", "well_name": "Permian Basin 1091",
        "date": "2025-01-18", "formation": "Wolfcamp B", "depth_ft": 11100,
        "event_type": "stuck_pipe", "severity": "high",
        "symptoms": ["torque_spike", "rop_drop", "pack_off"],
        "params": {"rop_ft_hr": 38, "wob_klbs": 30, "torque_kftlbs": 21, "mud_weight_ppg": 12.6, "flow_gpm": 610},
        "action_taken": "Circulated hi-vis pill immediately after first torque spike; reduced WOB",
        "outcome": "resolved", "time_lost_hrs": 6, "cost_impact_usd": 78000,
        "lessons": "Applied CASE-001 playbook. Faster recognition saved 8+ hrs vs prior similar events.",
        "evidence_refs": ["mud-log-01-18", "sensor-trace-01-18"]
    },
    {
        "id": "CASE-007", "well_id": "W-NS-5510", "well_name": "North Sea 5510",
        "date": "2024-09-12", "formation": "Paleocene Sandstone", "depth_ft": 10800,
        "event_type": "vibration", "severity": "medium",
        "symptoms": ["stick_slip", "torque_oscillation", "bit_bounce"],
        "params": {"rop_ft_hr": 68, "wob_klbs": 34, "torque_kftlbs": 19, "mud_weight_ppg": 11.4, "flow_gpm": 640},
        "action_taken": "Reduced RPM 140->110; adjusted WOB; damped stick-slip",
        "outcome": "resolved", "time_lost_hrs": 3, "cost_impact_usd": 34000,
        "lessons": "Bit-formation interaction. Softer engagement recommended for interbedded sands.",
        "evidence_refs": ["sensor-trace-09-12"]
    },
    {
        "id": "CASE-008", "well_id": "W-BK-2245", "well_name": "Bakken 2245",
        "date": "2025-02-03", "formation": "Three Forks", "depth_ft": 10000,
        "event_type": "stuck_pipe", "severity": "high",
        "symptoms": ["torque_spike", "rop_drop"],
        "params": {"rop_ft_hr": 40, "wob_klbs": 29, "torque_kftlbs": 23, "mud_weight_ppg": 11.6, "flow_gpm": 600},
        "action_taken": "In progress - live event",
        "outcome": "in_progress", "time_lost_hrs": 2, "cost_impact_usd": 30000,
        "lessons": "",
        "evidence_refs": ["sensor-trace-02-03", "morning-report-02-03"]
    },
]

# Sensor traces (depth, rop, torque, mud_weight) per case for the evidence viewer
def build_sensor_trace(case):
    depth_base = case["depth_ft"] - 200
    rop_base = case["params"]["rop_ft_hr"]
    torque_base = case["params"]["torque_kftlbs"]
    mw = case["params"]["mud_weight_ppg"]
    points = []
    for i in range(40):
        depth = depth_base + i * 5
        # simulate anomaly at the event depth
        anomaly_zone = abs(depth - case["depth_ft"]) < 30
        rop = rop_base + random.uniform(-8, 8) - (25 if anomaly_zone and case["event_type"] == "stuck_pipe" else 0)
        torque = torque_base + random.uniform(-2, 2) + (8 if anomaly_zone and case["event_type"] == "stuck_pipe" else 0)
        mud_weight = mw + random.uniform(-0.1, 0.1)
        points.append({
            "depth_ft": round(depth, 1),
            "rop_ft_hr": max(0, round(rop, 1)),
            "torque_kftlbs": round(torque, 2),
            "mud_weight_ppg": round(mud_weight, 2),
        })
    return points

# Evidence records with conflict flags
EVIDENCE = {
    "mud-log-08-14": {"id": "mud-log-08-14", "case_id": "CASE-001", "type": "mud_log", "author": "MudLogger J.Reyes", "timestamp": "2024-08-14T14:22:00Z", "content": "11,150 ft: Torque signature rising. Cuttings show tight shale. Recommend circulate.", "confidence": 0.92},
    "sensor-trace-08-14": {"id": "sensor-trace-08-14", "case_id": "CASE-001", "type": "sensor", "author": "EDR System", "timestamp": "2024-08-14T14:25:00Z", "content": "Torque 22 kftlbs (baseline 14). ROP dropped 45%. Standpipe erratic +/- 300 psi.", "confidence": 0.98},
    "morning-report-08-15": {"id": "morning-report-08-15", "case_id": "CASE-001", "type": "daily_report", "author": "Company Man T.Alvarez", "timestamp": "2024-08-15T06:00:00Z", "content": "Stuck pipe event 08-14 22:00. Freed 12:00 today. Root cause: pack-off from shale sloughing.", "confidence": 0.88},
    "mud-log-10-02": {"id": "mud-log-10-02", "case_id": "CASE-002", "type": "mud_log", "author": "MudLogger P.Kim", "timestamp": "2024-10-02T09:14:00Z", "content": "Connection gas 2200 units. Background 400. Flow increase noted.", "confidence": 0.95},
    "sensor-trace-10-02": {"id": "sensor-trace-10-02", "case_id": "CASE-002", "type": "sensor", "author": "EDR System", "timestamp": "2024-10-02T09:15:00Z", "content": "Flow-out > flow-in by 45 gpm. Pit gain 8 bbl over 3 min.", "confidence": 0.99},
    "well-control-report-10-02": {"id": "well-control-report-10-02", "case_id": "CASE-002", "type": "wc_report", "author": "Toolpusher R.Nash", "timestamp": "2024-10-02T15:30:00Z", "content": "Shut-in successful. SIDPP 320 psi. Killed with 11.9 ppg. Note: driller reports pit gain was ~4 bbl.", "confidence": 0.75, "conflict": {"with": "sensor-trace-10-02", "reason": "Pit gain magnitude disagreement: sensor 8 bbl vs driller report 4 bbl"}},
    "mud-log-06-20": {"id": "mud-log-06-20", "case_id": "CASE-003", "type": "mud_log", "author": "MudLogger A.Vance", "timestamp": "2024-06-20T11:05:00Z", "content": "Torque climbing steadily since 10,150 ft. Cuttings normal.", "confidence": 0.85},
    "sensor-trace-06-20": {"id": "sensor-trace-06-20", "case_id": "CASE-003", "type": "sensor", "author": "EDR System", "timestamp": "2024-06-20T11:10:00Z", "content": "Torque spike 24 kftlbs. Overpull observed. No rotation post-connection.", "confidence": 0.97},
    "morning-report-06-21": {"id": "morning-report-06-21", "case_id": "CASE-003", "type": "daily_report", "author": "Company Man L.Ford", "timestamp": "2024-06-21T06:00:00Z", "content": "Stuck pipe. Freed via chemical spot 26 hrs. Cause: differential sticking in porous zone.", "confidence": 0.7, "conflict": {"with": "mud-log-06-20", "reason": "Mechanism disagreement: report says differential sticking, mud log suggests mechanical (torque climb)"}},
    "mud-log-11-11": {"id": "mud-log-11-11", "case_id": "CASE-004", "type": "mud_log", "author": "MudLogger S.Ortiz", "timestamp": "2024-11-11T17:40:00Z", "content": "Losses initiated at 7,820 ft. Rate 15 bbl/hr. Full return after LCM sweep.", "confidence": 0.94},
    "sensor-trace-11-11": {"id": "sensor-trace-11-11", "case_id": "CASE-004", "type": "sensor", "author": "EDR System", "timestamp": "2024-11-11T17:35:00Z", "content": "Pit level -18 bbl over 30 min. Standpipe stable then dropped 200 psi.", "confidence": 0.98},
    "mud-log-03-05": {"id": "mud-log-03-05", "case_id": "CASE-005", "type": "mud_log", "author": "MudLogger D.Chen", "timestamp": "2024-03-05T03:15:00Z", "content": "Trip gas 4800 units on connection at 17,500 ft. Flow increase confirmed.", "confidence": 0.96},
    "sensor-trace-03-05": {"id": "sensor-trace-03-05", "case_id": "CASE-005", "type": "sensor", "author": "EDR System", "timestamp": "2024-03-05T03:20:00Z", "content": "Flow-out delta +62 gpm. Pit gain 12 bbl in 4 min. HPHT zone.", "confidence": 0.99},
    "well-control-report-03-05": {"id": "well-control-report-03-05", "case_id": "CASE-005", "type": "wc_report", "author": "OIM K.Larsen", "timestamp": "2024-03-05T14:00:00Z", "content": "Hard shut-in 03:22. SIDPP 680 psi. Killed with 16.4 ppg wait-and-weight over 11 hrs.", "confidence": 0.93},
    "mud-log-01-18": {"id": "mud-log-01-18", "case_id": "CASE-006", "type": "mud_log", "author": "MudLogger J.Reyes", "timestamp": "2025-01-18T13:00:00Z", "content": "Early torque signature at 11,090 ft. Applied CASE-001 playbook immediately.", "confidence": 0.9},
    "sensor-trace-01-18": {"id": "sensor-trace-01-18", "case_id": "CASE-006", "type": "sensor", "author": "EDR System", "timestamp": "2025-01-18T13:05:00Z", "content": "Torque 21 kftlbs. Pill circulated. Motion restored in 6 hrs.", "confidence": 0.98},
    "sensor-trace-09-12": {"id": "sensor-trace-09-12", "case_id": "CASE-007", "type": "sensor", "author": "EDR System", "timestamp": "2024-09-12T20:00:00Z", "content": "Stick-slip index 0.72. Torque oscillation +/- 5 kftlbs at 0.4 Hz.", "confidence": 0.95},
    "sensor-trace-02-03": {"id": "sensor-trace-02-03", "case_id": "CASE-008", "type": "sensor", "author": "EDR System", "timestamp": "2025-02-03T09:30:00Z", "content": "LIVE: Torque 23 kftlbs. ROP dropped 60%. Pack-off suspected.", "confidence": 0.98},
    "morning-report-02-03": {"id": "morning-report-02-03", "case_id": "CASE-008", "type": "daily_report", "author": "Company Man M.Ali", "timestamp": "2025-02-03T10:00:00Z", "content": "Torque spike observed. Consulting Recall Engine. Preliminary reading suggests slow drift, not spike.", "confidence": 0.6, "conflict": {"with": "sensor-trace-02-03", "reason": "Sensor shows sharp spike, company man report describes slow drift"}},
}

# Live current event (for recall engine demo)
LIVE_EVENT = {
    "well_id": "W-BK-2245",
    "well_name": "Bakken 2245",
    "formation": "Three Forks",
    "depth_ft": 10000,
    "symptoms": ["torque_spike", "rop_drop"],
    "params": {"rop_ft_hr": 40, "wob_klbs": 29, "torque_kftlbs": 23, "mud_weight_ppg": 11.6, "flow_gpm": 600},
    "timestamp": "2025-02-03T09:30:00Z",
}
