"""SegFormer (PixelMapINT) — semantic classes remapped to obstacle-style markings."""

from __future__ import annotations

import os
import threading
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np

_REPO_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_WEIGHTS = _REPO_ROOT / "model" / "PixelMapINT" / "model" / "segformer_spatial_model.pth"
_HF_ID = "nvidia/segformer-b0-finetuned-ade-512-512"
_NUM_LABELS = 7
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
}


def _weights_path() -> Path:
    raw = os.environ.get("ML_SEGFORMER_WEIGHTS", "").strip()
    return Path(raw) if raw else _DEFAULT_WEIGHTS


def _bgr_to_rgb(bgr: Tuple[int, int, int]) -> List[int]:
    b, g, r = bgr
    return [int(r), int(g), int(b)]


def init_detector() -> None:
    """Optional warmup; model loads lazily on first inference."""
    return


def ml_health() -> Dict[str, Any]:
    p = _weights_path()
    return {
        "pixelmap_weights": str(p),
        "weights_found": p.is_file(),
        "model_loaded": _state["model"] is not None,
        "device": _state.get("device"),
        "load_error": _state.get("load_error"),
        "tile_grid": _TILE_GRID,
        "tile_regions": _TILE_GRID * _TILE_GRID,
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


def _predict_class_mask(bgr: np.ndarray) -> np.ndarray:
    import cv2
    import torch

    _ensure_model()
    model = _state["model"]
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
) -> Tuple[np.ndarray, np.ndarray, List[Dict[str, Any]], Dict[str, Any]]:
    """
    Returns (overlay_bgr, marking_ids_fullres, marking_stats, tiling_info).
    marking_ids_fullres uses 0..4 for clear, vegetation, water, built, unknown.
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
    marking_full = _marking_mask_from_class(pred_full_class)
    color_full = _colorize_marking(marking_full)
    blend = np.clip((1.0 - alpha) * bgr.astype(np.float32) + alpha * color_full.astype(np.float32), 0, 255).astype(np.uint8)
    stats = _stats_for_marking_mask(marking_full, h * w)
    return blend, marking_full, stats, tiling


def run_detection(bgr: np.ndarray, filename: str) -> Dict[str, Any]:
    """
    Run PixelMapINT SegFormer and produce an obstacle-style marking map (semantic, not instances).
    """
    import cv2

    h, w = bgr.shape[:2]
    try:
        overlay_bgr, _marking_ids, stats, tiling = build_marking_overlay(bgr)
    except FileNotFoundError as e:
        return {
            "image_width": w,
            "image_height": h,
            "use_finetuned": False,
            "inference_note": str(e),
            "marking_stats": [],
            "result_relative_url": None,
        }
    except Exception as e:  # pragma: no cover
        return {
            "image_width": w,
            "image_height": h,
            "use_finetuned": False,
            "inference_note": f"Inference failed: {e}",
            "marking_stats": [],
            "result_relative_url": None,
        }

    ok, buf = cv2.imencode(".png", overlay_bgr)
    if not ok:
        raise RuntimeError("Could not encode marking PNG.")

    return {
        "image_width": w,
        "image_height": h,
        "use_finetuned": True,
        "inference_note": None,
        "marking_stats": stats,
        "marking_png_bytes": buf.tobytes(),
        "tiling": tiling,
    }
