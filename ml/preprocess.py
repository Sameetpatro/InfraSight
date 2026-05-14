"""Decode uploaded image bytes to BGR uint8 (OpenCV)."""

from __future__ import annotations

import numpy as np

try:
    import cv2
except ImportError as e:  # pragma: no cover
    raise ImportError("OpenCV is required for image decode (opencv-python-headless).") from e


def decode_upload_bytes(data: bytes) -> np.ndarray:
    if not data:
        raise ValueError("Empty image upload.")
    arr = np.frombuffer(data, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("Could not decode image (unsupported or corrupt file).")
    return bgr
