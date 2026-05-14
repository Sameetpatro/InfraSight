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
│
├── outputs/
│   └── smart_spatial_report.json
│
└── requirements.txt