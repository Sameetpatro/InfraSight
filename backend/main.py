"""
InfraSight API — PixelMapINT SegFormer marking map plus spatial intelligence (land-cover analytics,
governance alerts, optional change vs prior scan for the same location fingerprint).

Run from `backend/`:
  ./run_dev.sh
  # or (avoids “uvicorn: command not found” and avoids watching site-packages on --reload):
  .venv/bin/python -m uvicorn main:app --reload --port 8000 --reload-exclude 'venv/*' --reload-exclude '.venv/*'

Weights: `model/PixelMapINT/model/segformer_spatial_model.pth` or `ML_SEGFORMER_WEIGHTS`.
"""

from __future__ import annotations

import asyncio
import sys
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

_BACKEND_ROOT = Path(__file__).resolve().parent
_REPO_ROOT = _BACKEND_ROOT.parent
for _p in (_BACKEND_ROOT, _REPO_ROOT):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from memory import db as memory_db
from memory import fingerprint
from ml.integration import compare_class_coverage, init_detector, ml_health, run_detection
from ml import preprocess

RESULTS_DIR = _BACKEND_ROOT / "data" / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

JOBS: Dict[str, Dict[str, Any]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    memory_db.init_db()
    init_detector()
    yield


app = FastAPI(title="InfraSight API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/results", StaticFiles(directory=str(RESULTS_DIR)), name="results")


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", **ml_health()}


@app.post("/detect")
async def detect(image: UploadFile = File(...)) -> JSONResponse:
    raw = await image.read()
    try:
        bgr = preprocess.decode_upload_bytes(raw)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    filename = image.filename or "upload.jpg"
    loc_hash = fingerprint.location_hash_from_upload(filename, raw)
    prev_payload = memory_db.latest_scan_payload(loc_hash)

    loop = asyncio.get_event_loop()
    infer = await loop.run_in_executor(None, lambda: run_detection(bgr, filename))
    job_id = str(uuid.uuid4())
    processed_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    png_bytes = infer.pop("marking_png_bytes", None)
    use_ft = bool(infer.get("use_finetuned"))
    tiling = infer.get("tiling") or {}
    n_pass = int(tiling.get("forward_passes", 1))
    g = int(tiling.get("grid", 1))
    tile_hint = f" Image split into {g}×{g} regions ({n_pass} model runs) for finer detail." if use_ft and n_pass > 1 else ""
    model_note = (
        "PixelMapINT SegFormer-B0: yellow ≈ no major obstacle, pink = vegetation, blue = water, orange = built-up."
        + tile_hint
        if use_ft
        else "Weights missing or inference skipped; add segformer_spatial_model.pth or set ML_SEGFORMER_WEIGHTS."
    )

    prev_cov = (prev_payload or {}).get("class_coverage_percent")
    new_cov = infer.get("class_coverage_percent")
    change_detection = compare_class_coverage(prev_cov, new_cov) if prev_cov and new_cov else None

    body: Dict[str, Any] = {
        **infer,
        "job_id": job_id,
        "location_hash": loc_hash,
        "processed_at": processed_at,
        "model_note": model_note,
        "improvements": [],
        "change_detection": change_detection,
    }

    if png_bytes:
        out_path = RESULTS_DIR / f"{job_id}.png"
        out_path.write_bytes(png_bytes)
        body["result_url"] = f"/results/{job_id}.png"

    memory_db.insert_scan(job_id, loc_hash, body)
    JOBS[job_id] = body
    return JSONResponse(content=body)


@app.get("/summary/{location_hash}")
def summary(location_hash: str) -> Dict[str, Any]:
    tl = memory_db.timeline_for_location(location_hash)
    if not tl:
        raise HTTPException(status_code=404, detail="Unknown location_hash")
    latest = tl[-1]
    lp = memory_db.latest_scan_payload(location_hash)
    if lp:
        marking_stats = lp.get("marking_stats", [])
        processed_at = lp.get("processed_at", latest.get("processed_at"))
        spatial_intelligence = lp.get("spatial_intelligence")
        change_detection = lp.get("change_detection")
        class_coverage_percent = lp.get("class_coverage_percent")
    else:
        marking_stats = latest.get("marking_stats", [])
        processed_at = latest.get("processed_at")
        spatial_intelligence = None
        change_detection = None
        class_coverage_percent = None
    return {
        "location_hash": location_hash,
        "job_id": latest.get("job_id"),
        "processed_at": processed_at,
        "marking_stats": marking_stats,
        "timeline": tl,
        "spatial_intelligence": spatial_intelligence,
        "change_detection": change_detection,
        "class_coverage_percent": class_coverage_percent,
    }
