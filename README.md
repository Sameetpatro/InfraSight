# InfraSight

InfraSight is an end-to-end workspace for **geospatial intelligence from aerial or satellite imagery**. It combines a **React** web app, a **FastAPI** service, and the **PixelMapINT** pipeline: a 7-class **SegFormer** land-cover model with optional specialist heads (building, water, road) and an advisory **YOLO** waste detector. The API returns a colored **marking map** overlay, structured **spatial analytics**, rule-based **governance alerts**, and **change hints** when a second scan matches the same location fingerprint.

---

## What you get

- **Semantic land-cover** (urban, agricultural, open/rangeland, forest, water, barren, unknown) with an obstacle-style overlay: clear routing vs vegetation, water, and built-up areas.
- **Optional fusion**: binary SegFormer specialists override building and water regions; road masks are treated as routable (clear) on the marking map.
- **Waste advisory**: bounding boxes drawn on the overlay when `best.pt` (YOLO) is present; detections feed into spatial alerts.
- **Spatial intelligence**: coverage percentages, estimated areas (assuming ~0.5 m GSD per pixel in the analytics layer), patch counts, and governance-style alerts.
- **Scan memory**: SQLite stores each job; uploads with the same **location hash** enable **class-coverage change** reporting vs the previous scan.

---

## Repository layout

| Path | Role |
|------|------|
| `frontend/` | React 18 UI (upload, canvas, summary, Three.js hero). Proxies API calls to the backend in development. |
| `backend/` | FastAPI app (`main.py`), SQLite memory, static serving of result PNGs under `/results`. |
| `ml/` | Inference integration (`integration.py`), image decode (`preprocess.py`), shared `requirements.txt` pulled in by the backend. |
| `model/PixelMapINT/` | Checkpoints, deployment scripts, notebooks, and sub-README for the PixelMapINT / SegFormer story. |

---

## Prerequisites

- **Python 3.10+** (recommended for PyTorch + Transformers).
- **Node.js 18+** and npm for the frontend.
- **GPU** optional; CUDA is used when available.

---

## Model weights and environment variables

Default checkpoint paths live under `model/PixelMapINT/model/`:

| Asset | Default file | Override env var |
|-------|----------------|------------------|
| Main 7-class SegFormer | `segformer_spatial_model.pth` | `ML_SEGFORMER_WEIGHTS` |
| Building specialist (2-class) | `building_segformer.pth` | `ML_BUILDING_SEGFORMER_WEIGHTS` |
| Road specialist | `road_segformer.pth` | `ML_ROAD_SEGFORMER_WEIGHTS` |
| Water specialist | `water_segformer.pth` | `ML_WATER_SEGFORMER_WEIGHTS` |
| Waste (YOLO) | `best.pt` | `ML_WASTE_YOLO_WEIGHTS` |

- **Hugging Face** base weights for `nvidia/segformer-b0-finetuned-ade-512-512` are cached under `.hf_cache/` at the repo root (created on first run).
- **Tiling**: set `ML_TILE_GRID` (default `2`) for an N×N grid of crops; each tile runs SegFormer and results are stitched for finer detail on large images.

If the main weights file is missing, the API still responds but marks inference as skipped and omits the overlay until weights are installed.

---

## Backend setup and run

From the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
./run_dev.sh
```

The API listens on **http://127.0.0.1:8000** with auto-reload. Equivalent manual command (if `uvicorn` is not on your PATH):

```bash
.venv/bin/python -m uvicorn main:app --reload --port 8000 --host 127.0.0.1 \
  --reload-exclude 'venv/*' --reload-exclude '.venv/*' \
  --reload-exclude '*/site-packages/*' --reload-exclude 'data/results/*'
```

- **Health**: `GET /health` — includes ML weight discovery and load status.
- **Detect**: `POST /detect` — multipart field `image` (file upload). Returns JSON plus `result_url` for the marking PNG when inference succeeds.
- **Summary**: `GET /summary/{location_hash}` — timeline and latest analytics for that location.

Result images are written under `backend/data/results/` and exposed at `/results/{job_id}.png`.

---

## Frontend setup and run

In a second terminal:

```bash
cd frontend
npm install
npm start
```

The dev server uses the **proxy** in `frontend/package.json` to forward `/detect`, `/summary`, `/health`, and `/results` to `http://127.0.0.1:8000`. Start the backend first, then open the app URL printed by Create React App (typically **http://localhost:3000**).

Production build:

```bash
npm run build
```

Serve the `frontend/build/` static files behind a reverse proxy that also routes API requests to the FastAPI app, or configure your deployment URLs accordingly.

---

## Location fingerprinting and change detection

- Each upload gets a **`location_hash`**. By default this is derived from the image bytes (`loc_<sha256 prefix>`).
- For demos, filenames containing **`demo`** or **`delhi`** map to a fixed hash (`demo_delhi_001`) so you can simulate repeat visits and see **change_detection** in the UI.
- The previous scan for the same hash is loaded before inference; land-cover percentage deltas drive the change report and alerts.

Persistent state uses **`backend/data/memory.db`** (see `.gitignore` — local DB files are typically not committed).

---

## Further reading

- **`model/PixelMapINT/README.md`** — hackathon origin, feature list, and high-level pipeline narrative.
- **`model/PixelMapINT/model/INSTRUCTIONS.md`** — fusion architecture, specialist roles, and analytics conventions for PixelMapINT.

---

## Disclaimer

Outputs are **research and decision-support aids**, not certified surveying or regulatory compliance. Always verify critical findings in the field and with authoritative GIS data.
