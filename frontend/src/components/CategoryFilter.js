import React from "react";

const META = {
  Buildings: { color: "#FF6B6B", short: "Bld" },
  Trees: { color: "#51CF66", short: "Tree" },
  "Water Bodies": { color: "#339AF0", short: "Water" },
  Roads: { color: "#868E96", short: "Road" },
  Parks: { color: "#94D82D", short: "Park" },
  Drains: { color: "#F59F00", short: "Drain" },
  "Vehicles & Parking": { color: "#CC5DE8", short: "Veh" },
  "Waste Dumps": { color: "#FF922B", short: "Waste" },
  "Solar Panels": { color: "#22B8CF", short: "Solar" },
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

export default function CategoryFilter({ detections, visible, onToggle }) {
  const counts = {};
  ORDER.forEach((c) => {
    counts[c] = 0;
  });
  (detections || []).forEach((d) => {
    if (counts[d.category] !== undefined) counts[d.category] += 1;
  });

  return (
    <div className="category-filter">
      <div className="category-filter__title">Categories</div>
      <div className="category-filter__chips">
        {ORDER.map((cat) => {
          const on = visible.has(cat);
          const m = META[cat];
          return (
            <button
              key={cat}
              type="button"
              className={`chip ${on ? "chip--on" : "chip--off"}`}
              style={{ "--chip": m.color }}
              onClick={() => onToggle(cat)}
              aria-pressed={on}
            >
              <span className="chip__sq" style={{ background: m.color }} />
              <span className="chip__label">{cat}</span>
              <span className="chip__badge">{counts[cat]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
