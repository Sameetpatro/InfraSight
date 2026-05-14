"""Location fingerprinting for longitudinal memory."""

from __future__ import annotations

import hashlib
from typing import Optional


def location_hash_from_upload(filename: Optional[str], image_bytes: bytes) -> str:
    """
    Stable hash for a location. Demo shortcut: filenames containing 'demo' or 'delhi'
    map to the pre-seeded Delhi railway corridor timeline.
    """
    name = (filename or "").lower()
    if "demo" in name or "delhi" in name:
        return "demo_delhi_001"
    digest = hashlib.sha256(image_bytes).hexdigest()[:24]
    return f"loc_{digest}"
