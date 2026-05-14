import React from "react";

export default function SummaryPanel({ markingStats, visible, modelNote }) {
  const rows = markingStats || [];

  return (
    <div className={`summary-panel ${visible ? "summary-panel--on" : ""}`}>
      <div className="summary-panel__title">Marking coverage</div>
      <p className="summary-panel__lead">
        Yellow highlights areas the model treats as open for routing; pink is vegetation, blue is water, orange is built-up.
        This is semantic land-cover, not instance segmentation — use it as a starting layer for your own workflows.
      </p>
      {modelNote ? (
        <div className="summary-panel__model-note" role="status">
          {modelNote}
        </div>
      ) : null}
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
