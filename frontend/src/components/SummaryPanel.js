import React from "react";

function severityTone(sev) {
  if (sev === "High") return "spatial-alert--high";
  if (sev === "Medium") return "spatial-alert--med";
  return "spatial-alert--low";
}

export default function SummaryPanel({
  markingStats,
  visible,
  modelNote,
  spatialIntelligence,
  changeDetection,
  pixelmapPipeline,
}) {
  const rows = markingStats || [];
  const report = spatialIntelligence && spatialIntelligence.report;
  const assets = report && Array.isArray(report.detected_assets) ? report.detected_assets : [];
  const alerts = report && Array.isArray(report.spatial_alerts) ? report.spatial_alerts : [];
  const clusters = spatialIntelligence && spatialIntelligence.region_clusters;
  const waste =
    spatialIntelligence && Array.isArray(spatialIntelligence.waste_detections)
      ? spatialIntelligence.waste_detections
      : [];
  const changeAlerts = changeDetection && Array.isArray(changeDetection.change_alerts) ? changeDetection.change_alerts : [];
  const changeReport = changeDetection && changeDetection.change_report;

  return (
    <div className={`summary-panel ${visible ? "summary-panel--on" : ""}`}>
      <div className="summary-panel__title">Marking coverage</div>
      <p className="summary-panel__lead">
        Yellow highlights areas the model treats as open for routing; pink is vegetation, blue is water, orange is built-up.
        Specialist heads refine buildings and water on the class map; roads are forced to “clear” for routing where the road
        model fires. Red rectangles on the result image are advisory waste detections.
      </p>
      {modelNote ? (
        <div className="summary-panel__model-note" role="status">
          {modelNote}
        </div>
      ) : null}

      {pixelmapPipeline ? (
        <div className="summary-panel__pipeline" role="status">
          <span className="summary-panel__pipeline-label">Fusion pipeline</span>
          {pixelmapPipeline.building_specialist ? <span className="pipeline-chip">Buildings</span> : null}
          {pixelmapPipeline.water_specialist ? <span className="pipeline-chip">Water</span> : null}
          {pixelmapPipeline.road_specialist ? <span className="pipeline-chip">Roads</span> : null}
          {pixelmapPipeline.waste_yolo_weights_present ? (
            <span className="pipeline-chip">
              Waste YOLO
              {typeof pixelmapPipeline.waste_detection_count === "number"
                ? ` (${pixelmapPipeline.waste_detection_count})`
                : ""}
            </span>
          ) : null}
        </div>
      ) : null}

      {spatialIntelligence ? (
        <>
          <div className="summary-panel__title summary-panel__title--spaced">Spatial intelligence</div>
          <p className="summary-panel__lead summary-panel__lead--tight">
            Land-cover rollups, governance-style rule alerts, disconnected patch counts, and optional waste hits (same
            spirit as the PixelMapINT spatial layer).
          </p>
          {waste.length > 0 ? (
            <div className="spatial-waste">
              <div className="summary-panel__insights-title">Waste / dumping (detector)</div>
              <p className="summary-panel__lead summary-panel__lead--tight">
                Bounding boxes are drawn on the marking image; coordinates are in upload pixel space.
              </p>
              <div className="spatial-assets__scroll">
                <table className="spatial-assets__table">
                  <thead>
                    <tr>
                      <th scope="col">Class</th>
                      <th scope="col">Confidence</th>
                      <th scope="col">BBox (px)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waste.map((w, idx) => (
                      <tr key={`${w.class}-${idx}`}>
                        <td>{w.class}</td>
                        <td>{w.confidence != null ? Number(w.confidence).toFixed(3) : "—"}</td>
                        <td className="spatial-waste__bbox">
                          {Array.isArray(w.bbox) && w.bbox.length === 4
                            ? w.bbox.map((n) => Math.round(n)).join(", ")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {clusters ? (
            <div className="spatial-clusters" role="status">
              <span className="spatial-clusters__item">Urban patches: {clusters.urban_patches ?? "—"}</span>
              <span className="spatial-clusters__sep" aria-hidden="true" />
              <span className="spatial-clusters__item">Forest patches: {clusters.forest_patches ?? "—"}</span>
            </div>
          ) : null}

          {alerts.length > 0 ? (
            <div className="spatial-alerts">
              <div className="summary-panel__insights-title">Governance alerts</div>
              <ul className="spatial-alerts__list">
                {alerts.map((a) => (
                  <li key={a.alert} className={`spatial-alert ${severityTone(a.severity)}`}>
                    <div className="spatial-alert__head">
                      <span className="spatial-alert__name">{a.alert}</span>
                      {a.severity ? <span className="spatial-alert__sev">{a.severity}</span> : null}
                    </div>
                    {a.description ? <p className="spatial-alert__desc">{a.description}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="spatial-muted">No governance alerts triggered for this frame.</p>
          )}

          {assets.length > 0 ? (
            <div className="spatial-assets">
              <div className="summary-panel__insights-title">Land-cover mix (SegFormer classes)</div>
              <div className="spatial-assets__scroll">
                <table className="spatial-assets__table">
                  <thead>
                    <tr>
                      <th scope="col">Class</th>
                      <th scope="col">Coverage</th>
                      <th scope="col">Est. area (m²)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((row) => (
                      <tr key={row.asset_type}>
                        <td>{row.asset_type}</td>
                        <td>{Number(row.coverage_percent || 0).toFixed(1)}%</td>
                        <td>{row.estimated_area_sq_m != null ? Number(row.estimated_area_sq_m).toLocaleString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {changeDetection ? (
        <div className="spatial-change">
          <div className="summary-panel__insights-title">Change vs last scan</div>
          <p className="summary-panel__lead summary-panel__lead--tight">
            Same location fingerprint as your previous upload — comparing land-cover percentages.
          </p>
          {changeAlerts.length > 0 ? (
            <ul className="summary-panel__insights-list spatial-change__alerts">
              {changeAlerts.map((t) => (
                <li key={t} className="summary-panel__insights-item">
                  {t}
                </li>
              ))}
            </ul>
          ) : (
            <p className="spatial-muted">No large land-cover swings vs the prior scan.</p>
          )}
          {changeReport ? (
            <details className="spatial-change__details">
              <summary>Full per-class delta</summary>
              <div className="spatial-assets__scroll spatial-assets__scroll--sm">
                <table className="spatial-assets__table">
                  <thead>
                    <tr>
                      <th scope="col">Class</th>
                      <th scope="col">Before</th>
                      <th scope="col">After</th>
                      <th scope="col">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(changeReport).map(([name, v]) => (
                      <tr key={name}>
                        <td>{name}</td>
                        <td>{Number(v.before_percent).toFixed(1)}%</td>
                        <td>{Number(v.after_percent).toFixed(1)}%</td>
                        <td className={v.change_percent > 0 ? "spatial-delta--up" : v.change_percent < 0 ? "spatial-delta--down" : ""}>
                          {v.change_percent > 0 ? "+" : ""}
                          {Number(v.change_percent).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      <div className="summary-panel__title summary-panel__title--spaced">Routing overlay legend</div>
      <div className="summary-panel__legend">
        {rows.map((row) => {
          const rgb = row.color_rgb || [180, 180, 180];
          const sw = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
          return (
            <div key={row.marking} className="legend-row">
              <span className="legend-row__sw" style={{ background: sw }} aria-hidden="true" />
              <div className="legend-row__text">
                <div className="legend-row__label">{row.label}</div>
                <div className="legend-row__pct">{Number(row.coverage_percent || 0).toFixed(1)}% of image</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
