"""SegFormer (PixelMapINT) — semantic classes remapped to obstacle-style markings."""

from __future__ import annotations

import os
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

_REPO_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_WEIGHTS = _REPO_ROOT / "model" / "PixelMapINT" / "model" / "segformer_spatial_model.pth"
_PIXELMAP_MODEL_DIR = _REPO_ROOT / "model" / "PixelMapINT" / "model"
_DEFAULT_WASTE_YOLO = _PIXELMAP_MODEL_DIR / "best.pt"
_HF_ID = "nvidia/segformer-b0-finetuned-ade-512-512"
_NUM_LABELS = 7
_BINARY_NUM_LABELS = 2
# 2×2 = 4 tiles: each crop is run through SegFormer at model resolution, then stitched (override with ML_TILE_GRID).
_TILE_GRID = int(os.environ.get("ML_TILE_GRID", "2"))


def _axis_tile_ranges(length: int, parts: int) -> List[Tuple[int, int]]:
    """Partition [0, length) into up to `parts` slices; first `length % parts` slices are one pixel wider when needed."""
    if length <= 0 or parts <= 0:
        return []
    base = length // parts
    rem = length % parts
    y = 0
    out: List[Tuple[int, int]] = []
    for i in range(parts):
        dy = base + (1 if i < rem else 0)
        y0, y1 = y, y + dy
        y = y1
        if y1 > y0:
            out.append((y0, y1))
    return out


# PixelMapINT class ids → marking keys (not instance segmentation).
_CLASS_ID_TO_MARKING: Dict[int, str] = {
    0: "built",  # Urban land — structures / hard obstacle
    1: "clear",  # Agricultural — treated as open for routing overlay
    2: "clear",  # Open / rangeland
    3: "vegetation",  # Forest & green — trees / vegetation obstacle
    4: "water",
    5: "clear",  # Barren
    6: "unknown",
}

_CLASS_DISPLAY_NAMES: Dict[int, str] = {
    0: "Urban Land",
    1: "Agricultural Land",
    2: "Open/Rangeland",
    3: "Forest & Green Cover",
    4: "Water Bodies",
    5: "Barren Land",
    6: "Unknown",
}

_ASSET_STATUS: Dict[str, str] = {
    "Urban Land": "Built-up or developed regions detected",
    "Agricultural Land": "Agricultural activity zones identified",
    "Open/Rangeland": "Open land or sparse vegetation identified",
    "Forest & Green Cover": "Green cover and vegetation detected",
    "Water Bodies": "Water resource regions identified",
    "Barren Land": "Low vegetation or unused land identified",
    "Unknown": "Unclassified terrain detected",
}

_GSD_METERS = 0.5

_MARKING_META: Dict[str, Dict[str, Any]] = {
    "clear": {
        "label": "No major obstacle",
        "detail": "Open, barren, or agricultural (model view — verify on site).",
        "bgr": (60, 220, 255),  # bright yellow
    },
    "vegetation": {
        "label": "Vegetation / trees",
        "detail": "Dense green — treat as obstacle for clearance.",
        "bgr": (180, 105, 255),  # pink / magenta in BGR
    },
    "water": {
        "label": "Water",
        "detail": "Water body — obstacle.",
        "bgr": (230, 100, 30),  # strong blue
    },
    "built": {
        "label": "Built-up / urban",
        "detail": "Structures and developed land — obstacle.",
        "bgr": (80, 80, 255),  # orange-red
    },
    "unknown": {
        "label": "Unknown / mixed",
        "detail": "Low-confidence class — verify manually.",
        "bgr": (100, 100, 100),
    },
}

_lock = threading.Lock()
_state: Dict[str, Any] = {
    "model": None,
    "processor": None,
    "device": None,
    "load_error": None,
    "binary_models": {},
    "yolo": None,
    "yolo_error": None,
    "yolo_import_failed": False,
}


def _weights_path() -> Path:
    raw = os.environ.get("ML_SEGFORMER_WEIGHTS", "").strip()
    return Path(raw) if raw else _DEFAULT_WEIGHTS


def _binary_weights_path(kind: str) -> Path:
    env_map = {"building": "ML_BUILDING_SEGFORMER_WEIGHTS", "road": "ML_ROAD_SEGFORMER_WEIGHTS", "water": "ML_WATER_SEGFORMER_WEIGHTS"}
    raw = os.environ.get(env_map[kind], "").strip()
    if raw:
        return Path(raw)
    files = {
        "building": "building_segformer.pth",
        "road": "road_segformer.pth",
        "water": "water_segformer.pth",
    }
    return _PIXELMAP_MODEL_DIR / files[kind]


def _waste_yolo_path() -> Path:
    raw = os.environ.get("ML_WASTE_YOLO_WEIGHTS", "").strip()
    return Path(raw) if raw else _DEFAULT_WASTE_YOLO


def _bgr_to_rgb(bgr: Tuple[int, int, int]) -> List[int]:
    b, g, r = bgr
    return [int(r), int(g), int(b)]


def init_detector() -> None:
    """Optional warmup; model loads lazily on first inference."""
    return


def ml_health() -> Dict[str, Any]:
    p = _weights_path()
    fusion = {k: _binary_weights_path(k).is_file() for k in ("building", "road", "water")}
    yp = _waste_yolo_path()
    return {
        "pixelmap_weights": str(p),
        "weights_found": p.is_file(),
        "model_loaded": _state["model"] is not None,
        "device": _state.get("device"),
        "load_error": _state.get("load_error"),
        "tile_grid": _TILE_GRID,
        "tile_regions": _TILE_GRID * _TILE_GRID,
        "specialist_segformer_weights": fusion,
        "waste_yolo_weights_path": str(yp),
        "waste_yolo_weights_found": yp.is_file(),
        "waste_yolo_error": _state.get("yolo_error"),
    }


def _ensure_model() -> None:
    if _state["model"] is not None:
        return
    with _lock:
        if _state["model"] is not None:
            return
        hf_home = _REPO_ROOT / ".hf_cache"
        hf_home.mkdir(parents=True, exist_ok=True)
        os.environ.setdefault("HF_HOME", str(hf_home))

        try:
            import torch
            from transformers import SegformerForSemanticSegmentation, SegformerImageProcessor
        except ImportError as e:
            _state["load_error"] = str(e)
            raise

        weights = _weights_path()
        if not weights.is_file():
            _state["load_error"] = f"Missing weights: {weights}"
            raise FileNotFoundError(_state["load_error"])

        device = "cuda" if torch.cuda.is_available() else "cpu"
        processor = SegformerImageProcessor.from_pretrained(_HF_ID)
        model = SegformerForSemanticSegmentation.from_pretrained(
            _HF_ID,
            num_labels=_NUM_LABELS,
            ignore_mismatched_sizes=True,
        )
        state = torch.load(str(weights), map_location=device)
        model.load_state_dict(state)
        model.to(device)
        model.eval()

        _state["processor"] = processor
        _state["model"] = model
        _state["device"] = device
        _state["load_error"] = None


def _predict_with_segformer(bgr: np.ndarray, model: Any) -> np.ndarray:
    """Run a SegFormer model; returns 2D class ids at the processor output resolution."""
    import cv2
    import torch

    processor = _state["processor"]
    device = _state["device"]
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    pil_inputs = processor(images=rgb, return_tensors="pt")
    pixel_values = pil_inputs["pixel_values"].to(device)
    with torch.no_grad():
        out = model(pixel_values=pixel_values)
        logits = out.logits
    pred = logits.argmax(dim=1).squeeze(0).cpu().numpy().astype(np.uint8)
    return pred


def _get_binary_segformer(kind: str) -> Optional[Any]:
    """Lazy-load a 2-class SegFormer specialist, or None if weights are missing."""
    _ensure_model()
    device = _state["device"]
    cache: Dict[str, Any] = _state["binary_models"]
    with _lock:
        if kind in cache:
            return cache[kind]
        path = _binary_weights_path(kind)
        if not path.is_file():
            cache[kind] = None
            return None
        import torch
        from transformers import SegformerForSemanticSegmentation

        model = SegformerForSemanticSegmentation.from_pretrained(
            _HF_ID,
            num_labels=_BINARY_NUM_LABELS,
            ignore_mismatched_sizes=True,
        )
        state = torch.load(str(path), map_location=device)
        model.load_state_dict(state)
        model.to(device)
        model.eval()
        cache[kind] = model
        return model


def _binary_mask_fullres(bgr: np.ndarray, h: int, w: int, kind: str) -> Optional[np.ndarray]:
    import cv2

    model = _get_binary_segformer(kind)
    if model is None:
        return None
    small = _predict_with_segformer(bgr, model)
    mask = (small == 1).astype(np.uint8)
    if mask.size == 0:
        return None
    return cv2.resize(mask, (w, h), interpolation=cv2.INTER_NEAREST)


def _fuse_semantic_with_specialists(
    semantic_hw: np.ndarray,
    building_hw: Optional[np.ndarray],
    water_hw: Optional[np.ndarray],
) -> np.ndarray:
    """Building and water specialists override semantic logits (priority before roads on marking)."""
    fused = semantic_hw.copy()
    if building_hw is not None:
        fused[building_hw == 1] = 0
    if water_hw is not None:
        fused[water_hw == 1] = 4
    return fused


def _apply_road_to_marking(marking: np.ndarray, road_hw: Optional[np.ndarray]) -> np.ndarray:
    """Roads are treated as routable (clear) and overwrite other markings, including water."""
    if road_hw is None:
        return marking
    out = marking.copy()
    out[road_hw == 1] = 0
    return out


def _get_yolo_waste() -> Optional[Any]:
    path = _waste_yolo_path()
    if not path.is_file():
        _state["yolo_error"] = None
        return None
    if _state.get("yolo") is not None:
        return _state["yolo"]
    if _state.get("yolo_import_failed"):
        return None
    try:
        from ultralytics import YOLO
    except ImportError as e:
        _state["yolo_import_failed"] = True
        _state["yolo_error"] = str(e)
        return None
    try:
        model = YOLO(str(path))
    except Exception as e:  # pragma: no cover
        _state["yolo_error"] = str(e)
        return None
    _state["yolo"] = model
    _state["yolo_error"] = None
    return model


def _detect_waste(bgr: np.ndarray) -> List[Dict[str, Any]]:
    model = _get_yolo_waste()
    if model is None:
        return []
    try:
        res = model.predict(bgr, verbose=False, conf=0.22, imgsz=640)
    except Exception:
        return []
    if not res:
        return []
    r0 = res[0]
    if r0.boxes is None or len(r0.boxes) == 0:
        return []
    h, w = bgr.shape[:2]
    names = getattr(r0, "names", None) or {}
    out: List[Dict[str, Any]] = []
    xyxy = r0.boxes.xyxy.cpu().numpy()
    confs = r0.boxes.conf.cpu().numpy()
    clss = r0.boxes.cls.cpu().numpy().astype(int)
    for i in range(len(xyxy)):
        x1, y1, x2, y2 = xyxy[i].tolist()
        x1, y1 = max(0.0, x1), max(0.0, y1)
        x2, y2 = min(float(w - 1), x2), min(float(h - 1), y2)
        cid = int(clss[i])
        if isinstance(names, dict):
            label = str(names.get(cid, f"class_{cid}"))
        else:
            label = str(cid)
        out.append(
            {
                "class": label,
                "confidence": round(float(confs[i]), 4),
                "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
            }
        )
    return out


def _draw_waste_boxes(bgr: np.ndarray, detections: List[Dict[str, Any]]) -> None:
    import cv2

    for d in detections:
        box = d.get("bbox") or []
        if len(box) != 4:
            continue
        x1, y1, x2, y2 = [int(round(v)) for v in box]
        cv2.rectangle(bgr, (x1, y1), (x2, y2), (0, 0, 255), 2)
        label = str(d.get("class", "waste"))
        conf = d.get("confidence")
        cap = f"{label}" + (f" {conf:.2f}" if conf is not None else "")
        cv2.putText(
            bgr,
            cap[:48],
            (x1, max(0, y1 - 6)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (0, 0, 255),
            1,
            cv2.LINE_AA,
        )


def _predict_class_mask(bgr: np.ndarray) -> np.ndarray:
    _ensure_model()
    return _predict_with_segformer(bgr, _state["model"])


def _predict_class_mask_tiled(bgr: np.ndarray, grid: int) -> Tuple[np.ndarray, int]:
    """
    Run SegFormer on a grid×grid partition (default 2×2 = 4 crops), stitch class ids to full resolution.
    """
    import cv2

    h, w = bgr.shape[:2]
    rows = _axis_tile_ranges(h, grid)
    cols = _axis_tile_ranges(w, grid)
    full_class = np.zeros((h, w), dtype=np.uint8)
    forwards = 0
    for y0, y1 in rows:
        if y1 <= y0:
            continue
        for x0, x1 in cols:
            if x1 <= x0:
                continue
            crop = bgr[y0:y1, x0:x1]
            if crop.size == 0:
                continue
            pred_small = _predict_class_mask(crop)
            th, tw = y1 - y0, x1 - x0
            pred_tile = cv2.resize(pred_small, (tw, th), interpolation=cv2.INTER_NEAREST)
            full_class[y0:y1, x0:x1] = pred_tile
            forwards += 1
    return full_class, forwards


def _marking_mask_from_class(pred: np.ndarray) -> np.ndarray:
    """Map low-res class ids to marking keys encoded as uint8 0..4."""
    keys = ["clear", "vegetation", "water", "built", "unknown"]
    key_to_id = {k: i for i, k in enumerate(keys)}
    h, w = pred.shape
    flat = pred.reshape(-1)
    mapped = np.zeros_like(flat, dtype=np.uint8)
    for cid in range(_NUM_LABELS):
        marking = _CLASS_ID_TO_MARKING.get(cid, "unknown")
        mid = key_to_id.get(marking, key_to_id["unknown"])
        mapped[flat == cid] = mid
    return mapped.reshape(h, w)


def _build_class_coverage_map(report: Dict[str, Any]) -> Dict[str, float]:
    out: Dict[str, float] = {}
    for row in report.get("detected_assets", []):
        name = row.get("asset_type")
        if name is not None:
            out[str(name)] = float(row.get("coverage_percent") or 0.0)
    return out


def build_spatial_asset_report(pred_mask: np.ndarray) -> Dict[str, Any]:
    """Per-pixel land-cover rollups aligned with PixelMapINT `inference.py` spatial report."""
    pixel_area_sq_m = _GSD_METERS * _GSD_METERS
    total_pixels = int(pred_mask.size)
    flat = pred_mask.reshape(-1)
    results: List[Dict[str, Any]] = []
    for cid in range(_NUM_LABELS):
        name = _CLASS_DISPLAY_NAMES[cid]
        count = int((flat == cid).sum())
        coverage_percent = (100.0 * count / float(total_pixels)) if total_pixels else 0.0
        estimated_area = float(count) * pixel_area_sq_m
        results.append(
            {
                "asset_type": name,
                "estimated_area_sq_m": round(estimated_area, 2),
                "coverage_percent": round(coverage_percent, 2),
                "status": _ASSET_STATUS.get(name, ""),
            }
        )
    return {
        "report_type": "Spatial Asset Analysis",
        "model": "SegFormer-B0",
        "assumed_gsd_m_per_pixel": _GSD_METERS,
        "total_image_area_sq_m": round(float(total_pixels * pixel_area_sq_m), 2),
        "detected_assets": results,
    }


def attach_spatial_alerts(report: Dict[str, Any]) -> Dict[str, Any]:
    """Rule-based governance-style alerts (same rules as `model/PixelMapINT/deployment/inference.py`)."""
    alerts: List[Dict[str, Any]] = []
    coverage_map: Dict[str, float] = {}
    for asset in report.get("detected_assets", []):
        coverage_map[str(asset["asset_type"])] = float(asset.get("coverage_percent") or 0.0)

    urban = coverage_map.get("Urban Land", 0.0)
    green = coverage_map.get("Forest & Green Cover", 0.0)
    water = coverage_map.get("Water Bodies", 0.0)
    open_land = coverage_map.get("Open/Rangeland", 0.0)

    if urban > 45 and green < 15:
        alerts.append(
            {
                "alert": "Urban Heat Island Risk",
                "severity": "High",
                "description": "Dense urban coverage with insufficient green cover detected.",
            }
        )

    if green < 10:
        alerts.append(
            {
                "alert": "Green Cover Deficiency",
                "severity": "Medium",
                "description": "Low vegetation coverage detected.",
            }
        )

    if water > 20 and urban > 25:
        alerts.append(
            {
                "alert": "Potential Flood Vulnerability",
                "severity": "Medium",
                "description": "Large water-body presence near urban regions detected.",
            }
        )

    if open_land > 30 and green < 15:
        alerts.append(
            {
                "alert": "Urban Planning Opportunity",
                "severity": "Low",
                "description": "Open land suitable for green-zone development detected.",
            }
        )

    report["spatial_alerts"] = alerts
    return report


def _count_components_for_class(pred: np.ndarray, class_id: int) -> int:
    import cv2

    m = (pred == class_id).astype(np.uint8)
    if m.sum() == 0:
        return 0
    n, _, _, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    return max(0, int(n) - 1)


def build_spatial_intelligence(pred_class: np.ndarray) -> Dict[str, Any]:
    report = build_spatial_asset_report(pred_class)
    attach_spatial_alerts(report)
    clusters = {
        "urban_patches": _count_components_for_class(pred_class, 0),
        "forest_patches": _count_components_for_class(pred_class, 3),
    }
    return {"report": report, "region_clusters": clusters}


def compare_class_coverage(
    prev: Optional[Dict[str, float]],
    new: Optional[Dict[str, float]],
) -> Optional[Dict[str, Any]]:
    """Compare land-cover percentages between two scans (same `location_hash`)."""
    if not prev or not new:
        return None
    names = [_CLASS_DISPLAY_NAMES[i] for i in range(_NUM_LABELS)]
    change_report: Dict[str, Any] = {}
    for name in names:
        old_v = float(prev.get(name, 0.0) or 0.0)
        new_v = float(new.get(name, 0.0) or 0.0)
        change_report[name] = {
            "before_percent": round(old_v, 2),
            "after_percent": round(new_v, 2),
            "change_percent": round(new_v - old_v, 2),
        }
    change_alerts: List[str] = []
    fc = change_report["Forest & Green Cover"]["change_percent"]
    uc = change_report["Urban Land"]["change_percent"]
    if fc < -10:
        change_alerts.append("Significant green cover reduction detected.")
    if uc > 10:
        change_alerts.append("Rapid urban expansion / possible encroachment detected.")
    return {
        "change_report": change_report,
        "change_alerts": change_alerts,
    }


def _stats_for_marking_mask(marking_ids: np.ndarray, total_pixels: int) -> List[Dict[str, Any]]:
    keys = ["clear", "vegetation", "water", "built", "unknown"]
    out: List[Dict[str, Any]] = []
    flat = marking_ids.reshape(-1)
    for mid, key in enumerate(keys):
        count = int((flat == mid).sum())
        pct = round(100.0 * count / float(total_pixels), 2) if total_pixels else 0.0
        meta = _MARKING_META[key]
        out.append(
            {
                "marking": key,
                "label": meta["label"],
                "detail": meta["detail"],
                "coverage_percent": pct,
                "color_rgb": _bgr_to_rgb(tuple(meta["bgr"])),
            }
        )
    return out


def _colorize_marking(marking_ids: np.ndarray) -> np.ndarray:
    import cv2

    keys = ["clear", "vegetation", "water", "built", "unknown"]
    h, w = marking_ids.shape
    layer = np.zeros((h, w, 3), dtype=np.uint8)
    for mid, key in enumerate(keys):
        bgr = tuple(_MARKING_META[key]["bgr"])
        layer[marking_ids == mid] = bgr
    return layer


def build_marking_overlay(
    bgr: np.ndarray, alpha: float = 0.48
) -> Tuple[np.ndarray, np.ndarray, List[Dict[str, Any]], Dict[str, Any], np.ndarray, Dict[str, Any]]:
    """
    Returns (overlay_bgr, marking_ids_fullres, marking_stats, tiling_info, fused_class_mask_hw, aux).

    fused_class_mask_hw: 7-class semantic map after building/water specialist fusion (full resolution).
    aux keys: waste_detections (list), pipeline (which specialists ran).
    """
    import cv2

    h, w = bgr.shape[:2]
    grid = max(1, _TILE_GRID)
    if grid <= 1:
        pred_full_class = _predict_class_mask(bgr)
        pred_full_class = cv2.resize(pred_full_class, (w, h), interpolation=cv2.INTER_NEAREST)
        tiling = {"grid": 1, "forward_passes": 1}
    else:
        pred_full_class, forwards = _predict_class_mask_tiled(bgr, grid)
        tiling = {"grid": grid, "forward_passes": forwards}

    building_hw = _binary_mask_fullres(bgr, h, w, "building")
    water_hw = _binary_mask_fullres(bgr, h, w, "water")
    road_hw = _binary_mask_fullres(bgr, h, w, "road")

    fused_class = _fuse_semantic_with_specialists(pred_full_class, building_hw, water_hw)
    marking_full = _marking_mask_from_class(fused_class)
    marking_full = _apply_road_to_marking(marking_full, road_hw)

    color_full = _colorize_marking(marking_full)
    blend = np.clip((1.0 - alpha) * bgr.astype(np.float32) + alpha * color_full.astype(np.float32), 0, 255).astype(np.uint8)

    waste_detections = _detect_waste(bgr)
    if waste_detections:
        _draw_waste_boxes(blend, waste_detections)

    stats = _stats_for_marking_mask(marking_full, h * w)
    pipeline: Dict[str, Any] = {
        "semantic_segformer": True,
        "building_specialist": building_hw is not None,
        "water_specialist": water_hw is not None,
        "road_specialist": road_hw is not None,
        "waste_yolo_weights_present": _waste_yolo_path().is_file(),
        "waste_detection_count": len(waste_detections),
        "waste_yolo_load_error": _state.get("yolo_error"),
    }

    aux = {"waste_detections": waste_detections, "pipeline": pipeline}
    return blend, marking_full, stats, tiling, fused_class, aux


def _merge_waste_into_spatial(spatial: Dict[str, Any], waste_detections: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not waste_detections:
        return spatial
    spatial = dict(spatial)
    spatial["waste_detections"] = waste_detections
    rep = dict(spatial["report"])
    alerts = list(rep.get("spatial_alerts", []))
    alerts.insert(
        0,
        {
            "alert": "Solid waste / dumping (detector)",
            "severity": "High",
            "description": f"Vision model flagged {len(waste_detections)} candidate region(s). Treat as advisory and verify on site.",
        },
    )
    rep["spatial_alerts"] = alerts
    spatial["report"] = rep
    return spatial


def run_detection(bgr: np.ndarray, filename: str) -> Dict[str, Any]:
    """
    Run PixelMapINT SegFormer and produce an obstacle-style marking map (semantic, not instances).
    """
    import cv2

    h, w = bgr.shape[:2]
    try:
        overlay_bgr, _marking_ids, stats, tiling, pred_class, aux = build_marking_overlay(bgr)
    except FileNotFoundError as e:
        return {
            "image_width": w,
            "image_height": h,
            "use_finetuned": False,
            "inference_note": str(e),
            "marking_stats": [],
            "result_relative_url": None,
            "spatial_intelligence": None,
            "class_coverage_percent": None,
            "pixelmap_pipeline": None,
            "waste_detections": [],
        }
    except Exception as e:  # pragma: no cover
        return {
            "image_width": w,
            "image_height": h,
            "use_finetuned": False,
            "inference_note": f"Inference failed: {e}",
            "marking_stats": [],
            "result_relative_url": None,
            "spatial_intelligence": None,
            "class_coverage_percent": None,
            "pixelmap_pipeline": None,
            "waste_detections": [],
        }

    ok, buf = cv2.imencode(".png", overlay_bgr)
    if not ok:
        raise RuntimeError("Could not encode marking PNG.")

    waste_detections = aux.get("waste_detections") or []
    pipeline = aux.get("pipeline") or {}

    spatial = build_spatial_intelligence(pred_class)
    spatial = _merge_waste_into_spatial(spatial, waste_detections)
    class_cov = _build_class_coverage_map(spatial["report"])

    return {
        "image_width": w,
        "image_height": h,
        "use_finetuned": True,
        "inference_note": None,
        "marking_stats": stats,
        "marking_png_bytes": buf.tobytes(),
        "tiling": tiling,
        "spatial_intelligence": spatial,
        "class_coverage_percent": class_cov,
        "pixelmap_pipeline": pipeline,
        "waste_detections": waste_detections,
    }
