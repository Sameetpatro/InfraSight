import asyncio
import io
import json
import random
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import Body, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="InfraSight API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CATEGORIES = [
    "Buildings",
    "Trees",
    "Water Bodies",
    "Roads",
    "Parks",
    "Drains",
    "Vehicles & Parking",
    "Waste Dumps",
    "Solar Panels",
]

BASE_DETECTIONS: List[Dict[str, Any]] = [
    {"id": 1, "category": "Buildings", "confidence": 0.92, "bbox": [120, 80, 300, 200], "area_sqm": 1840},
    {"id": 2, "category": "Trees", "confidence": 0.87, "bbox": [50, 30, 160, 140], "area_sqm": 620},
    {"id": 3, "category": "Water Bodies", "confidence": 0.95, "bbox": [400, 300, 580, 420], "area_sqm": 3100},
    {"id": 4, "category": "Roads", "confidence": 0.78, "bbox": [0, 200, 640, 240], "area_sqm": 950},
    {"id": 5, "category": "Parks", "confidence": 0.83, "bbox": [200, 350, 380, 480], "area_sqm": 2200},
    {"id": 6, "category": "Drains", "confidence": 0.71, "bbox": [310, 90, 390, 180], "area_sqm": 340},
    {"id": 7, "category": "Vehicles & Parking", "confidence": 0.80, "bbox": [450, 100, 580, 190], "area_sqm": 420},
    {"id": 8, "category": "Waste Dumps", "confidence": 0.74, "bbox": [60, 300, 180, 390], "area_sqm": 510},
    {"id": 9, "category": "Solar Panels", "confidence": 0.88, "bbox": [240, 60, 360, 130], "area_sqm": 275},
]

JOBS: Dict[str, Dict[str, Any]] = {}


def _jitter_bbox(bbox: List[int], img_w: int, img_h: int) -> List[int]:
    x1, y1, x2, y2 = bbox
    dx = random.randint(-25, 25)
    dy = random.randint(-20, 20)
    x1 = max(0, min(img_w - 40, x1 + dx))
    y1 = max(0, min(img_h - 40, y1 + dy))
    x2 = max(x1 + 20, min(img_w, x2 + random.randint(-20, 20)))
    y2 = max(y1 + 20, min(img_h, y2 + random.randint(-15, 15)))
    return [x1, y1, x2, y2]


def _build_detections() -> Dict[str, Any]:
    image_width = 640
    image_height = 480
    detections: List[Dict[str, Any]] = []
    for row in BASE_DETECTIONS:
        conf = float(row["confidence"])
        conf = max(0.55, min(0.99, conf + random.uniform(-0.08, 0.06)))
        bbox = _jitter_bbox(list(row["bbox"]), image_width, image_height)
        x1, y1, x2, y2 = bbox
        base_area = row["area_sqm"]
        area_sqm = max(10, int(base_area * random.uniform(0.85, 1.15)))
        detections.append(
            {
                "id": row["id"],
                "category": row["category"],
                "confidence": round(conf, 3),
                "bbox": bbox,
                "area_sqm": area_sqm,
            }
        )
    return {
        "detections": detections,
        "image_width": image_width,
        "image_height": image_height,
        "processed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def _summary_from_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    per_category: Dict[str, Dict[str, float]] = {}
    for name in CATEGORIES:
        per_category[name] = {"count": 0, "area_sqm": 0.0}
    for det in payload.get("detections", []):
        cat = det.get("category")
        if cat not in per_category:
            per_category[cat] = {"count": 0, "area_sqm": 0.0}
        per_category[cat]["count"] += 1
        per_category[cat]["area_sqm"] += float(det.get("area_sqm", 0))
    return {
        "job_id": payload.get("job_id"),
        "processed_at": payload.get("processed_at"),
        "categories": [
            {
                "category": name,
                "count": int(per_category[name]["count"]),
                "area_sqm": round(per_category[name]["area_sqm"], 2),
            }
            for name in CATEGORIES
        ],
    }


def _detections_to_geojson(job_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    center_lat = 28.6139
    center_lon = 77.2090
    img_w = float(payload.get("image_width") or 640)
    img_h = float(payload.get("image_height") or 480)
    features: List[Dict[str, Any]] = []
    for det in payload.get("detections", []):
        x1, y1, x2, y2 = det["bbox"]
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        lat = center_lat + ((cy / img_h) - 0.5) * 0.04
        lon = center_lon + ((cx / img_w) - 0.5) * 0.04
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "job_id": job_id,
                    "category": det["category"],
                    "confidence": det["confidence"],
                    "area_sqm": det["area_sqm"],
                    "bbox_pixels": det["bbox"],
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


class ExportRequest(BaseModel):
    job_id: Optional[str] = None


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/detect")
async def detect(image: UploadFile = File(...)) -> JSONResponse:
    delay = random.uniform(1.0, 2.0)
    await asyncio.sleep(delay)
    job_id = str(uuid.uuid4())
    body = _build_detections()
    body["job_id"] = job_id
    JOBS[job_id] = body
    return JSONResponse(content=body)


@app.get("/summary/{job_id}")
def summary(job_id: str) -> Dict[str, Any]:
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Unknown job_id")
    payload = JOBS[job_id]
    return _summary_from_payload(payload)


@app.post("/export")
def export_geojson(req: ExportRequest = Body(default=ExportRequest())) -> StreamingResponse:
    resolved_id = req.job_id
    if not resolved_id and JOBS:
        resolved_id = next(reversed(JOBS.keys()))
    if not resolved_id or resolved_id not in JOBS:
        raise HTTPException(status_code=400, detail="job_id required or run /detect first")
    payload = JOBS[resolved_id]
    geo = _detections_to_geojson(resolved_id, payload)
    buf = io.BytesIO(json.dumps(geo, indent=2).encode("utf-8"))
    buf.seek(0)
    headers = {"Content-Disposition": 'attachment; filename="assets.geojson"'}
    return StreamingResponse(buf, media_type="application/geo+json", headers=headers)


@app.post("/change-detect")
async def change_detect(
    before: UploadFile = File(...),
    after: UploadFile = File(...),
) -> Dict[str, Any]:
    await asyncio.sleep(random.uniform(0.4, 0.9))
    new_items = [
        {"category": "Buildings", "label": "🚨 POSSIBLE ENCROACHMENT", "detail": "New structure footprint vs baseline mosaic."},
        {"category": "Waste Dumps", "label": "⚠ NEW ILLEGAL DUMP", "detail": "High-albedo debris cluster not present in prior capture."},
        {"category": "Trees", "label": "🌳 DEFORESTATION ALERT", "detail": "Canopy loss along ROW buffer polygon A-12."},
        {"category": "Drains", "label": "Drainage capacity delta", "detail": "Channel width reduced ~18% vs before image."},
    ]
    removed_items = [
        {"category": "Parks", "label": "Open space reduction", "detail": "Vegetation index drop in parcel NE-4."},
        {"category": "Solar Panels", "label": "Array removed", "detail": "Rooftop PV signature absent in after image."},
    ]
    random.shuffle(new_items)
    random.shuffle(removed_items)
    return {
        "job_reference": str(uuid.uuid4()),
        "compared_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "new_assets": new_items[: random.randint(2, 4)],
        "removed_assets": removed_items[: random.randint(1, 2)],
        "summary": {
            "pixels_changed_pct": round(random.uniform(1.2, 6.8), 2),
            "confidence": round(random.uniform(0.72, 0.91), 2),
        },
    }
