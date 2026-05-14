"""Human-readable improvement narratives between consecutive scans."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

SOURCE_RELIABILITY = {
    "HIGH": "high-resolution drone imagery",
    "MED": "medium-resolution satellite/aerial imagery",
    "LOW": "low-resolution Sentinel-2 imagery",
}


def _parse_date(iso_ts: str) -> str:
    try:
        return datetime.fromisoformat(iso_ts.replace("Z", "+00:00")).strftime("%Y-%m-%d")
    except ValueError:
        return iso_ts[:10]


def build_insight_sentence(
    category: str,
    delta_count: int,
    delta_area_pct: float,
    prev_scan_date: str,
    quality_tier: str,
) -> str:
    rel = SOURCE_RELIABILITY.get(quality_tier, SOURCE_RELIABILITY["MED"])
    day = _parse_date(prev_scan_date)
    if delta_count > 0:
        direction = "increased"
        mag = delta_count
    elif delta_count < 0:
        direction = "reduced"
        mag = abs(delta_count)
    else:
        direction = "changed"
        mag = 0
    ap = abs(delta_area_pct)
    sign = "+" if delta_area_pct >= 0 else "-"
    return (
        f"{category} has {direction} by {mag} detections ({sign}{ap:.1f}% area) "
        f"since last scan on {day} (detected via {rel})."
    )


def compare_payloads(
    prev: Optional[Dict[str, Any]],
    new: Dict[str, Any],
    quality_tier: str,
) -> List[Dict[str, Any]]:
    """Produce structured insight rows from category rollups."""
    if not prev:
        return []
    prev_dets = prev.get("detections") or []
    new_dets = new.get("detections") or []
    from collections import defaultdict

    def rollup(dets):
        c = defaultdict(lambda: {"count": 0, "area": 0.0})
        for d in dets:
            cat = d.get("category")
            c[cat]["count"] += 1
            c[cat]["area"] += float(d.get("area_sqm", 0))
        return c

    a = rollup(prev_dets)
    b = rollup(new_dets)
    cats = set(a.keys()) | set(b.keys())
    insights: List[Dict[str, Any]] = []
    prev_time = prev.get("processed_at", "")
    for cat in sorted(cats):
        ca = a.get(cat, {"count": 0, "area": 0.0})
        cb = b.get(cat, {"count": 0, "area": 0.0})
        dc = cb["count"] - ca["count"]
        pa = ca["area"] + 1e-6
        dap = (cb["area"] - ca["area"]) / pa * 100.0
        if dc == 0 and abs(dap) < 0.5:
            continue
        sentence = build_insight_sentence(cat, dc, dap, prev_time, quality_tier)
        insights.append(
            {
                "category": cat,
                "delta_count": dc,
                "delta_area_pct": round(dap, 2),
                "sentence": sentence,
            }
        )
    return insights
