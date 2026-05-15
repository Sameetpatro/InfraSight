# PixelMapINT — Multi-Model Fusion Architecture

## Overview

PixelMapINT uses a modular geospatial AI pipeline instead of relying on a single segmentation model.

Each specialized model focuses on one high-priority spatial feature:

* Road Segmentation
* Water Segmentation
* Building Segmentation
* Waste Detection
* Background Semantic Segmentation

This improves:

* accuracy
* visual quality
* scalability
* governance intelligence

---

# Core Architecture

```text
Input Satellite / Drone Image
                ↓
─────────────────────────────────
1. Road Segmentation Model
2. Water Segmentation Model
3. Building Segmentation Model
4. Waste Detection Model (YOLO)
5. Semantic Background Model
─────────────────────────────────
                ↓
      Priority-Based Fusion
                ↓
      Unified Intelligence Map
                ↓
      Analytics + Alerts + JSON
```

---

# Processing Order

The order of execution is important.

## 1. Building Segmentation

Purpose:

* detect infrastructure regions
* estimate building count
* urban density analysis

Output:

* binary mask

```python
0 = background
1 = building
```

---

## 2. Road Segmentation

Purpose:

* road network extraction
* accessibility analysis
* connectivity mapping

Output:

* binary mask

```python
0 = background
1 = road
```

Road segmentation receives higher priority than semantic classes.

---

## 3. Water Segmentation

Purpose:

* flood analysis
* drainage monitoring
* river/lake extraction

Output:

* binary mask

```python
0 = background
1 = water
```

---

## 4. Waste Detection (YOLO)

Purpose:

* solid waste detection
* dumping alerts
* sewage / environmental intelligence

Output:

* bounding boxes
* confidence scores

Example:

```json
{
  "class": "solid_waste",
  "confidence": 0.91,
  "bbox": [x1, y1, x2, y2]
}
```

Waste detections are overlaid separately and are NOT merged into segmentation masks.

---

## 5. Background Semantic Segmentation

Purpose:

* classify remaining broad land-cover regions

Recommended remaining classes:

* forest
* agriculture
* barren land
* open land

Important:
The semantic model should NOT be responsible for:

* roads
* buildings
* water
* waste

These are already handled by specialized models.

---

# Fusion Strategy

A final unified segmentation map is generated using priority-based fusion.

## Priority Order

Higher priority classes overwrite lower priority classes.

| Priority | Class           |
| -------- | --------------- |
| 1        | Waste Detection |
| 2        | Roads           |
| 3        | Water           |
| 4        | Buildings       |
| 5        | Forest          |
| 6        | Agriculture     |
| 7        | Barren Land     |

---

# Fusion Logic

Start with semantic segmentation output:

```python
final_mask = semantic_mask.copy()
```

Then overwrite using specialized masks:

```python
# buildings
final_mask[building_mask == 1] = BUILDING_ID

# water
final_mask[water_mask == 1] = WATER_ID

# roads
final_mask[road_mask == 1] = ROAD_ID
```

Roads overwrite water/buildings if overlap occurs.

---

# Important Rule — No Mask Modification

Specialized binary masks must remain untouched during processing.

Avoid:

* blurring
* smoothing
* recoloring
* resizing multiple times
* alpha blending before fusion

Always preserve raw prediction masks.

Reason:
visual overlays should never corrupt analytical outputs.

---

# Color Mapping Strategy

Never trust raw visualization colors from models.

Always use manual class-to-color mapping.

Example:

```python
CLASS_COLORS = {

    0: [0, 0, 0],         # background
    1: [128, 128, 128],   # road
    2: [0, 0, 255],       # water
    3: [255, 0, 0],       # building
    4: [0, 255, 0],       # forest
    5: [255, 255, 0],     # agriculture
    6: [139, 69, 19]      # barren land
}
```

---

# Overlay Rendering

Overlays should be generated only AFTER final fusion.

Recommended process:

```python
overlay = original_image.copy()

for class_id, color in CLASS_COLORS.items():

    overlay[final_mask == class_id] = color
```

This prevents:

* color inversion
* mask corruption
* class inconsistency

---

# Building Counting

Buildings are estimated using connected component analysis.

Example:

```python
cv2.connectedComponentsWithStats()
```

This provides pseudo-instance counting without requiring Mask R-CNN.

---

# Waste Detection Rendering

Waste detections should be rendered independently using YOLO bounding boxes.

Example:

* red rectangles
* confidence labels
* pollution alerts

Do not convert waste detections into segmentation masks.

---

# Analytics Layer

After fusion:

Generate:

* road coverage %
* water coverage %
* building density
* urbanization score
* flood risk
* sparse infrastructure alerts
* dumping alerts
* environmental warnings

---

# Change Detection

Future extension:

Compare:

* previous segmentation maps
* current segmentation maps

Detect:

* new roads
* construction
* deforestation
* water expansion
* illegal dumping growth

---

# Final Goal

PixelMapINT is designed as a modular geospatial intelligence system for:

* railway monitoring
* infrastructure analysis
* environmental governance
* urban planning
* disaster management
* aerial intelligence
