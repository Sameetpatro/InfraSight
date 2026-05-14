# AI Powered Spatial Asset Management System

This project was built for a hackathon focused on urban and railway spatial intelligence using satellite imagery and deep learning.

The system analyzes aerial or satellite images and automatically identifies different land and infrastructure regions such as:

- Urban land
- Green cover and forests
- Water bodies
- Agricultural land
- Open land
- Barren land

Along with segmentation overlays, the system also generates spatial analytics and simple governance-oriented alerts.

---

## Features

- Semantic segmentation using SegFormer-B0
- Satellite image analysis
- GIS-style colored overlays
- Estimated area calculation
- JSON metadata export
- Smart spatial alerts
- Deployment-ready inference pipeline

---

## Enhancement Update — Spatial Intelligence Layer

The project was enhanced beyond basic semantic segmentation into a lightweight spatial intelligence and governance analytics system for urban and railway infrastructure monitoring.

### Added Features

- **Governance Intelligence Engine**
  - Detects possible flood-prone regions
  - Identifies low green-cover zones
  - Flags dense urban expansion and environmental degradation
  - Generates automated governance alerts

- **Spatial Analytics**
  - Calculates land-cover distribution percentages
  - Estimates urban, forest, water, and barren land coverage
  - Produces structured spatial summaries

- **Pseudo-Instance Region Extraction**
  - Connected-component based region clustering
  - Detects fragmented urban and forest patches
  - Enables approximate asset-cluster counting

- **Temporal Change Detection**
  - Compares two uploaded images of the same region
  - Detects urban expansion, deforestation, and water reduction
  - Generates automated change alerts

- **Enhanced Visualization**
  - Improved color-coded overlays
  - Geographic-style legend support
  - Cleaner segmentation visualization

- **Smart JSON Export**
  - Exports:
    - asset statistics
    - governance alerts
    - change reports
    - environmental indicators

### Updated Pipeline

```text
Satellite / Drone Image
        ↓
Semantic Segmentation (SegFormer)
        ↓
Spatial Analytics Engine
        ↓
Governance Intelligence Layer
        ↓
Change Detection Engine
        ↓
Overlay + Alerts + JSON Export

## Spatial Intelligence Alerts

The system can generate rule-based insights such as:

- Low green cover detection
- Urban heat island risk
- Flood vulnerability indicators
- Open land planning opportunities

---

## Tech Stack

- Python
- PyTorch
- Hugging Face Transformers
- SegFormer-B0
- NumPy
- PIL

---

## Project Structure

```bash
project/
│
├── deployment/
│   └── inference.py
│
├── model/
│   └── segformer_spatial_model.pth
│
├── notebooks/
│   └── training_notebook.ipynb
│   └── enhancement_intel.ipynb
│
├── outputs/
│   └── smart_spatial_report.json
│
└── requirements.txt