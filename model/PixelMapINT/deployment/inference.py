import torch
import numpy as np
import json

from PIL import Image
from transformers import SegformerForSemanticSegmentation

# --------------------------------------------------
# Device
# --------------------------------------------------

device = "cuda" if torch.cuda.is_available() else "cpu"

print(f"Using device: {device}")

# --------------------------------------------------
# Class Labels
# --------------------------------------------------

CLASS_NAMES = {
    0: "Urban Land",
    1: "Agricultural Land",
    2: "Open/Rangeland",
    3: "Forest & Green Cover",
    4: "Water Bodies",
    5: "Barren Land",
    6: "Unknown"
}

# --------------------------------------------------
# Visualization Colors
# --------------------------------------------------

ID_TO_COLOR = {
    0: (0, 255, 255),
    1: (255, 255, 0),
    2: (255, 0, 255),
    3: (0, 255, 0),
    4: (0, 0, 255),
    5: (255, 255, 255),
    6: (0, 0, 0)
}

# --------------------------------------------------
# Load Model
# --------------------------------------------------

model = SegformerForSemanticSegmentation.from_pretrained(
    "nvidia/segformer-b0-finetuned-ade-512-512",
    num_labels=7,
    ignore_mismatched_sizes=True
)

model.load_state_dict(
    torch.load(
        "../model/segformer_spatial_model.pth",
        map_location=device
    )
)

model.to(device)
model.eval()

print("Model loaded successfully.")

# --------------------------------------------------
# Prediction
# --------------------------------------------------

def predict_image(image_path):

    image = Image.open(image_path).convert("RGB")

    resized = image.resize((512, 512))

    image_np = np.array(resized)

    tensor = torch.tensor(image_np) \
        .permute(2, 0, 1) \
        .float() / 255.0

    tensor = tensor.unsqueeze(0).to(device)

    with torch.no_grad():

        outputs = model(pixel_values=tensor)

        pred_mask = outputs.logits.argmax(dim=1)

    pred_mask = pred_mask.cpu().numpy()[0]

    return pred_mask

# --------------------------------------------------
# Overlay Generation
# --------------------------------------------------

def create_overlay(image_path, pred_mask):

    image = Image.open(image_path).convert("RGB")
    image = image.resize((128, 128))

    image_np = np.array(image)

    seg_rgb = np.zeros((128, 128, 3), dtype=np.uint8)

    for class_id, color in ID_TO_COLOR.items():
        seg_rgb[pred_mask == class_id] = color

    overlay = (
        0.6 * image_np +
        0.4 * seg_rgb
    ).astype(np.uint8)

    return overlay

# --------------------------------------------------
# Spatial Analytics
# --------------------------------------------------

def generate_spatial_report(pred_mask):

    GSD_METERS = 0.5
    PIXEL_AREA_SQ_M = GSD_METERS * GSD_METERS

    STATUS_MESSAGES = {
        "Urban Land": "Built-up or developed regions detected",
        "Agricultural Land": "Agricultural activity zones identified",
        "Open/Rangeland": "Open land or sparse vegetation identified",
        "Forest & Green Cover": "Green cover and vegetation detected",
        "Water Bodies": "Water resource regions identified",
        "Barren Land": "Low vegetation or unused land identified",
        "Unknown": "Unclassified terrain detected"
    }

    unique, counts = np.unique(pred_mask, return_counts=True)

    total_pixels = pred_mask.size

    results = []

    for class_id, count in zip(unique, counts):

        class_name = CLASS_NAMES[int(class_id)]

        coverage_percent = (count / total_pixels) * 100

        estimated_area = count * PIXEL_AREA_SQ_M

        results.append({
            "asset_type": class_name,
            "estimated_area_sq_m": round(float(estimated_area), 2),
            "coverage_percent": round(float(coverage_percent), 2),
            "status": STATUS_MESSAGES[class_name]
        })

    final_report = {
        "report_type": "Spatial Asset Analysis",
        "model": "SegFormer-B0",
        "assumed_gsd_m_per_pixel": GSD_METERS,
        "total_image_area_sq_m": round(
            float(total_pixels * PIXEL_AREA_SQ_M), 2
        ),
        "detected_assets": results
    }

    return final_report

# --------------------------------------------------
# Spatial Intelligence Alerts
# --------------------------------------------------

def generate_spatial_alerts(report):

    alerts = []

    coverage_map = {}

    for asset in report["detected_assets"]:
        coverage_map[asset["asset_type"]] = asset["coverage_percent"]

    urban = coverage_map.get("Urban Land", 0)
    green = coverage_map.get("Forest & Green Cover", 0)
    water = coverage_map.get("Water Bodies", 0)
    open_land = coverage_map.get("Open/Rangeland", 0)

    if urban > 45 and green < 15:
        alerts.append({
            "alert": "Urban Heat Island Risk",
            "severity": "High",
            "description": "Dense urban coverage with insufficient green cover detected."
        })

    if green < 10:
        alerts.append({
            "alert": "Green Cover Deficiency",
            "severity": "Medium",
            "description": "Low vegetation coverage detected."
        })

    if water > 20 and urban > 25:
        alerts.append({
            "alert": "Potential Flood Vulnerability",
            "severity": "Medium",
            "description": "Large water-body presence near urban regions detected."
        })

    if open_land > 30 and green < 15:
        alerts.append({
            "alert": "Urban Planning Opportunity",
            "severity": "Low",
            "description": "Open land suitable for green-zone development detected."
        })

    report["spatial_alerts"] = alerts

    return report

# --------------------------------------------------
# Save JSON Report
# --------------------------------------------------

def save_report(report, filename="smart_spatial_report.json"):

    with open(filename, "w") as f:
        json.dump(report, f, indent=4)

    print(f"Saved report: {filename}")

# --------------------------------------------------
# Full Pipeline
# --------------------------------------------------

def run_pipeline(image_path):

    pred_mask = predict_image(image_path)

    overlay = create_overlay(image_path, pred_mask)

    report = generate_spatial_report(pred_mask)

    report = generate_spatial_alerts(report)

    save_report(report)

    return {
        "prediction_mask": pred_mask,
        "overlay": overlay,
        "report": report
    }

# --------------------------------------------------
# Example Usage
# --------------------------------------------------

if __name__ == "__main__":

    image_path = "../sample/test_image.jpg"

    results = run_pipeline(image_path)

    print(json.dumps(results["report"], indent=4))