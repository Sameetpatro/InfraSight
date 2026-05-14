"""SQLite persistence for per-location scan history."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "memory.db"


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    c = _conn()
    try:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT NOT NULL,
                location_hash TEXT NOT NULL,
                processed_at TEXT NOT NULL,
                image_width INTEGER,
                image_height INTEGER,
                payload_json TEXT NOT NULL,
                UNIQUE(job_id)
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS improvements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                location_hash TEXT NOT NULL,
                prev_scan_id INTEGER,
                next_scan_id INTEGER NOT NULL,
                insights_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        c.execute("CREATE INDEX IF NOT EXISTS idx_scans_loc ON scans(location_hash)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_scans_time ON scans(processed_at)")
        c.commit()
    finally:
        c.close()


def insert_scan(
    job_id: str,
    location_hash: str,
    payload: Dict[str, Any],
) -> int:
    init_db()
    processed_at = payload.get("processed_at") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    row = (
        job_id,
        location_hash,
        processed_at,
        int(payload.get("image_width") or 0),
        int(payload.get("image_height") or 0),
        json.dumps(payload),
    )
    c = _conn()
    try:
        c.execute(
            "INSERT OR REPLACE INTO scans (job_id, location_hash, processed_at, image_width, image_height, payload_json) VALUES (?,?,?,?,?,?)",
            row,
        )
        cur = c.execute("SELECT id FROM scans WHERE job_id = ?", (job_id,))
        rid = int(cur.fetchone()[0])
        c.commit()
        return rid
    finally:
        c.close()


def previous_scan(location_hash: str) -> Optional[Tuple[int, Dict[str, Any]]]:
    """Return (scan_id, payload_dict) for the most recent scan at this location, if any."""
    init_db()
    c = _conn()
    try:
        cur = c.execute(
            "SELECT id, payload_json FROM scans WHERE location_hash = ? ORDER BY processed_at DESC LIMIT 1",
            (location_hash,),
        )
        row = cur.fetchone()
        if not row:
            return None
        return int(row[0]), json.loads(row[1])
    finally:
        c.close()


def scan_payload_by_job_id(job_id: str) -> Optional[Dict[str, Any]]:
    init_db()
    c = _conn()
    try:
        cur = c.execute("SELECT payload_json FROM scans WHERE job_id = ?", (job_id,))
        row = cur.fetchone()
        if not row:
            return None
        return json.loads(row[0])
    finally:
        c.close()


def insert_improvement(location_hash: str, prev_id: Optional[int], next_id: int, insights: List[dict]) -> None:
    init_db()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    c = _conn()
    try:
        c.execute(
            "INSERT INTO improvements (location_hash, prev_scan_id, next_scan_id, insights_json, created_at) VALUES (?,?,?,?,?)",
            (location_hash, prev_id, next_id, json.dumps(insights), now),
        )
        c.commit()
    finally:
        c.close()


def latest_scan_for_location(location_hash: str) -> Optional[sqlite3.Row]:
    init_db()
    c = _conn()
    try:
        cur = c.execute(
            "SELECT * FROM scans WHERE location_hash = ? ORDER BY processed_at DESC LIMIT 1 OFFSET 1",
            (location_hash,),
        )
        return cur.fetchone()
    finally:
        c.close()


def latest_scan_payload(location_hash: str) -> Optional[Dict[str, Any]]:
    init_db()
    c = _conn()
    try:
        cur = c.execute(
            "SELECT payload_json FROM scans WHERE location_hash = ? ORDER BY processed_at DESC LIMIT 1",
            (location_hash,),
        )
        row = cur.fetchone()
        if not row:
            return None
        return json.loads(row[0])
    finally:
        c.close()


def timeline_for_location(location_hash: str) -> List[Dict[str, Any]]:
    init_db()
    c = _conn()
    try:
        cur = c.execute(
            "SELECT job_id, processed_at, payload_json FROM scans WHERE location_hash = ? ORDER BY processed_at ASC",
            (location_hash,),
        )
        out: List[Dict[str, Any]] = []
        for r in cur.fetchall():
            p = json.loads(r["payload_json"])
            out.append(
                {
                    "job_id": r["job_id"],
                    "processed_at": r["processed_at"],
                    "marking_stats": p.get("marking_stats", []),
                }
            )
        return out
    finally:
        c.close()


def history_improvements(location_hash: str) -> List[Dict[str, Any]]:
    init_db()
    c = _conn()
    try:
        cur = c.execute(
            "SELECT * FROM improvements WHERE location_hash = ? ORDER BY created_at ASC",
            (location_hash,),
        )
        rows = []
        for row in cur.fetchall():
            d = dict(row)
            try:
                d["insights"] = json.loads(d.get("insights_json", "[]"))
            except json.JSONDecodeError:
                d["insights"] = []
            d.pop("insights_json", None)
            rows.append(d)
        return rows
    finally:
        c.close()


