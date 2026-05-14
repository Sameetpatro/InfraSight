import React, { useEffect, useRef, useState } from "react";

const ICONS = {
  Buildings: "🏢",
  Trees: "🌳",
  "Water Bodies": "💧",
  Roads: "🛣",
  Parks: "🌿",
  Drains: "🕳",
  "Vehicles & Parking": "🚗",
  "Waste Dumps": "⚠️",
  "Solar Panels": "☀️",
};

const ORDER = [
  "Buildings",
  "Trees",
  "Water Bodies",
  "Roads",
  "Parks",
  "Drains",
  "Vehicles & Parking",
  "Waste Dumps",
  "Solar Panels",
];

function useCountUp(target, durationMs, active) {
  const [val, setVal] = useState(0);
  const startRef = useRef(0);
  const fromRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setVal(0);
      return;
    }
    startRef.current = performance.now();
    fromRef.current = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(fromRef.current + (target - fromRef.current) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, durationMs, active]);

  return val;
}

function SummaryCard({ row, index, active }) {
  const countTarget = row.count || 0;
  const areaTarget = row.area_sqm || 0;
  const cAnim = useCountUp(countTarget, 900, active);
  const aAnim = useCountUp(areaTarget, 1100, active);
  const waste = row.category === "Waste Dumps";
  const buildings = row.category === "Buildings";
  const solar = row.category === "Solar Panels";

  return (
    <div
      className="summary-card"
      style={{ "--i": index, "--accent": row.color }}
      data-category={row.category}
    >
      <div className="summary-card__border" />
      <div className="summary-card__head">
        <div className="summary-card__icon" aria-hidden="true">
          {ICONS[row.category]}
        </div>
        <div>
          <div className="summary-card__name">{row.category}</div>
          <div className="summary-card__stats">
            <span className="summary-card__count">{Math.round(cAnim)}</span>
            <span className="summary-card__muted"> detections</span>
          </div>
        </div>
      </div>
      <div className="summary-card__area">
        <span className="summary-card__area-label">Total area</span>
        <span className="summary-card__area-val">{Math.round(aAnim).toLocaleString()} m²</span>
      </div>
      {waste && countTarget > 0 ? <div className="badge badge--pulse badge--danger">⚠ ILLEGAL DUMP DETECTED</div> : null}
      {buildings && countTarget > 1 ? <div className="badge badge--warn">🚨 ENCROACHMENT RISK</div> : null}
      {solar && countTarget > 0 ? <div className="badge badge--eco">ECO ✓</div> : null}
    </div>
  );
}

export default function SummaryPanel({ summary, visible }) {
  const rows = ORDER.map((name) => {
    const hit = (summary && summary.categories ? summary.categories : []).find((c) => c.category === name);
    const colors = {
      Buildings: "#FF6B6B",
      Trees: "#51CF66",
      "Water Bodies": "#339AF0",
      Roads: "#868E96",
      Parks: "#94D82D",
      Drains: "#F59F00",
      "Vehicles & Parking": "#CC5DE8",
      "Waste Dumps": "#FF922B",
      "Solar Panels": "#22B8CF",
    };
    return {
      category: name,
      count: hit ? hit.count : 0,
      area_sqm: hit ? hit.area_sqm : 0,
      color: colors[name],
    };
  });

  return (
    <div className={`summary-panel ${visible ? "summary-panel--on" : ""}`}>
      <div className="summary-panel__title">Category intelligence</div>
      <div className="summary-panel__grid">
        {rows.map((r, i) => (
          <SummaryCard key={r.category} row={r} index={i} active={visible} />
        ))}
      </div>
    </div>
  );
}
