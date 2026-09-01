"""Minimal LAS 2.0 parser for well log files."""
import re
from typing import Dict, Any, List


def parse_las(text: str) -> Dict[str, Any]:
    """Parse LAS 2.0 text. Returns {well: {...}, curves: [names], data: [[...],...]}."""
    sections = {}
    current = None
    lines = text.splitlines()
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("~"):
            current = stripped[1].upper()  # W, C, A, etc.
            sections[current] = []
            continue
        if current:
            sections[current].append(line)

    # Parse well info (~W)
    well_info = {}
    for line in sections.get("W", []):
        # Format: MNEM.UNIT   DATA : DESCRIPTION
        m = re.match(r"\s*([A-Z0-9]+)\s*\.\S*\s+([^:]+):\s*(.*)", line)
        if m:
            mnem, data, desc = m.group(1), m.group(2).strip(), m.group(3).strip()
            well_info[mnem] = data

    # Parse curves (~C) — get column names in order
    curves = []
    for line in sections.get("C", []):
        m = re.match(r"\s*([A-Z0-9_]+)\s*\.", line)
        if m:
            curves.append(m.group(1))

    # Parse data (~A) — numeric rows
    data = []
    for line in sections.get("A", []):
        parts = line.split()
        try:
            row = [float(p) for p in parts]
            if row:
                data.append(row)
        except ValueError:
            continue

    return {"well_info": well_info, "curves": curves, "data": data}


def las_to_case(parsed: Dict[str, Any], well_id: str, well_name: str, formation: str = "Unknown") -> Dict[str, Any]:
    """Convert parsed LAS into a case-shaped record with sensor trace."""
    curves = [c.upper() for c in parsed["curves"]]
    data = parsed["data"]
    if not data:
        return None

    # Map common curves to our schema
    def col(name_options):
        for n in name_options:
            if n in curves:
                return curves.index(n)
        return None

    depth_idx = col(["DEPT", "DEPTH", "MD"])
    rop_idx = col(["ROP", "ROPA", "ROP5"])
    torque_idx = col(["TORQUE", "TQ", "TQA"])
    mw_idx = col(["MW", "MWT", "MUD_WEIGHT"])
    wob_idx = col(["WOB", "WOBA"])

    trace = []
    max_torque = 0
    min_rop = float("inf")
    event_depth = 0
    for row in data[:200]:
        d = row[depth_idx] if depth_idx is not None else 0
        r = row[rop_idx] if rop_idx is not None and rop_idx < len(row) else 0
        t = row[torque_idx] if torque_idx is not None and torque_idx < len(row) else 0
        mw = row[mw_idx] if mw_idx is not None and mw_idx < len(row) else 0
        trace.append({
            "depth_ft": round(d, 1),
            "rop_ft_hr": round(r, 1),
            "torque_kftlbs": round(t, 2),
            "mud_weight_ppg": round(mw, 2),
        })
        if t > max_torque:
            max_torque = t
            event_depth = d
        if r > 0 and r < min_rop:
            min_rop = r

    # Simple anomaly detection: high torque + low ROP suggests stuck pipe
    symptoms = []
    if max_torque > 20:
        symptoms.append("torque_spike")
    if min_rop < 15:
        symptoms.append("rop_drop")

    event_type = "stuck_pipe" if len(symptoms) >= 2 else "vibration" if max_torque > 15 else "normal_drilling"
    severity = "high" if max_torque > 22 else "medium" if max_torque > 18 else "low"

    return {
        "trace": trace,
        "event_type": event_type,
        "severity": severity,
        "depth_ft": round(event_depth or (data[-1][depth_idx] if depth_idx is not None else 0), 0),
        "symptoms": symptoms or ["normal"],
        "params": {
            "torque_kftlbs": round(max_torque, 1),
            "rop_ft_hr": round(min_rop if min_rop < float("inf") else 0, 1),
            "mud_weight_ppg": round(trace[-1]["mud_weight_ppg"] if trace else 0, 1),
            "wob_klbs": round(data[-1][wob_idx] if wob_idx is not None else 0, 1),
        },
        "curves_available": curves,
        "row_count": len(data),
        "well_info": parsed["well_info"],
    }
