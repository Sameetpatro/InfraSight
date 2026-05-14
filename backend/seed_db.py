"""Optional idempotent seed for demo location timeline (marking_stats only)."""

from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from memory import db as memory_db


def _payload(job_id: str, processed_at: str, stats: list) -> dict:
    return {
        "job_id": job_id,
        "location_hash": "demo_delhi_001",
        "processed_at": processed_at,
        "image_width": 1280,
        "image_height": 720,
        "use_finetuned": False,
        "model_note": "Seeded placeholder (no image file).",
        "marking_stats": stats,
        "improvements": [],
        "result_url": None,
    }


def main() -> None:
    memory_db.init_db()
    seeds = [
        (
            "seed_demo_delhi_2025_01_10",
            "2025-01-10T10:00:00Z",
            [
                {"marking": "vegetation", "label": "Vegetation / trees", "coverage_percent": 42.0, "color_rgb": [255, 105, 180]},
                {"marking": "water", "label": "Water", "coverage_percent": 3.0, "color_rgb": [30, 100, 230]},
                {"marking": "clear", "label": "No major obstacle", "coverage_percent": 48.0, "color_rgb": [255, 220, 60]},
                {"marking": "built", "label": "Built-up / urban", "coverage_percent": 6.0, "color_rgb": [255, 80, 71]},
                {"marking": "unknown", "label": "Unknown / mixed", "coverage_percent": 1.0, "color_rgb": [100, 100, 100]},
            ],
        ),
        (
            "seed_demo_delhi_2025_05_01",
            "2025-05-01T10:00:00Z",
            [
                {"marking": "vegetation", "label": "Vegetation / trees", "coverage_percent": 35.0, "color_rgb": [255, 105, 180]},
                {"marking": "water", "label": "Water", "coverage_percent": 4.0, "color_rgb": [30, 100, 230]},
                {"marking": "clear", "label": "No major obstacle", "coverage_percent": 52.0, "color_rgb": [255, 220, 60]},
                {"marking": "built", "label": "Built-up / urban", "coverage_percent": 8.0, "color_rgb": [255, 80, 71]},
                {"marking": "unknown", "label": "Unknown / mixed", "coverage_percent": 1.0, "color_rgb": [100, 100, 100]},
            ],
        ),
    ]
    conn = sqlite3.connect(str(memory_db.DB_PATH))
    try:
        for job_id, ts, stats in seeds:
            cur = conn.execute("SELECT 1 FROM scans WHERE job_id = ?", (job_id,))
            if cur.fetchone():
                continue
            payload = _payload(job_id, ts, stats)
            conn.execute(
                "INSERT INTO scans (job_id, location_hash, processed_at, image_width, image_height, payload_json) VALUES (?,?,?,?,?,?)",
                (
                    job_id,
                    "demo_delhi_001",
                    ts,
                    payload["image_width"],
                    payload["image_height"],
                    json.dumps(payload),
                ),
            )
        conn.commit()
    finally:
        conn.close()
    print("Seed complete (idempotent): demo_delhi_001 timeline ready.")


if __name__ == "__main__":
    main()
