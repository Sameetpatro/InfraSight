import React, { useEffect, useMemo, useState } from "react";

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

function useRafCount(target, ms, active) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) {
      setV(0);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setV(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, active]);
  return v;
}

export default function Analytics({ detections, active }) {
  const total = (detections || []).length;
  const areaM2 = (detections || []).reduce((s, d) => s + (d.area_sqm || 0), 0);
  const avgConf =
    total === 0 ? 0 : (detections || []).reduce((s, d) => s + (d.confidence || 0), 0) / total;
  const avgPct = Math.round(avgConf * 100);

  const n1 = useRafCount(total, 900, active);
  const n2 = useRafCount(areaM2 / 1e6, 1200, active);
  const [ring, setRing] = useState(0);
  useEffect(() => {
    if (!active) {
      setRing(0);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const target = avgPct;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 1000);
      setRing(target * t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [avgPct, active]);

  const counts = useMemo(() => {
    const m = {};
    ORDER.forEach((k) => {
      m[k] = 0;
    });
    (detections || []).forEach((d) => {
      if (m[d.category] !== undefined) m[d.category] += 1;
    });
    return m;
  }, [detections]);

  const max = Math.max(1, ...ORDER.map((k) => counts[k]));

  return (
    <div className={`analytics ${active ? "analytics--on" : ""}`}>
      <div className="analytics__grid4">
        <div className="stat-card">
          <div className="stat-card__k">Total assets detected</div>
          <div className="stat-card__v">{Math.round(n1)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__k">Coverage (approx.)</div>
          <div className="stat-card__v">{n2.toFixed(3)}</div>
          <div className="stat-card__u">sq km</div>
        </div>
        <div className="stat-card stat-card--ring">
          <div className="stat-card__k">Mean confidence</div>
          <svg className="ring" viewBox="0 0 120 120" aria-label={`Mean confidence ${avgPct} percent`}>
            <circle className="ring__track" cx="60" cy="60" r="44" />
            <circle
              className="ring__prog"
              cx="60"
              cy="60"
              r="44"
              transform="rotate(-90 60 60)"
              strokeDasharray={`${(ring / 100) * 276.46} 276.46`}
            />
            <text x="60" y="66" textAnchor="middle" className="ring__txt">
              {Math.round(ring)}%
            </text>
          </svg>
        </div>
        <div className="stat-card">
          <div className="stat-card__k">Operational posture</div>
          <div className="stat-card__sub">Live fusion of CV + cadastral stubs</div>
          <div className="stat-pill stat-pill--ok">Nominal</div>
        </div>
      </div>

      <div className="analytics__bars">
        <div className="bars-head">Asset category breakdown</div>
        {ORDER.map((k, i) => (
          <div key={k} className="bar-row">
            <div className="bar-row__label">{k}</div>
            <div className="bar-row__track">
              <div
                className="bar-row__fill"
                style={{ width: active ? `${(counts[k] / max) * 100}%` : "0%", transitionDelay: `${i * 40}ms` }}
              />
            </div>
            <div className="bar-row__num">{counts[k]}</div>
          </div>
        ))}
      </div>

      <div className="analytics__lower">
        <div className="panel">
          <div className="panel__h">Recent scans</div>
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Location</th>
                <th>Assets</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["2026-05-12 09:14", "Delhi / NDLS corridor", "42", "Synced"],
                ["2026-05-11 21:02", "Ghaziabad maintenance block", "37", "Synced"],
                ["2026-05-11 16:40", "Mathura freight yard", "29", "Queued"],
                ["2026-05-10 11:55", "Jaipur satellite siding", "51", "Synced"],
                ["2026-05-09 08:21", "Bhopal ART staging", "18", "Alert"],
              ].map((row, idx) => (
                <tr key={idx}>
                  <td>{row[0]}</td>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                  <td>
                    <span className={`pill pill--${row[3] === "Alert" ? "bad" : row[3] === "Queued" ? "warn" : "ok"}`}>{row[3]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <div className="panel__h">Risk alerts</div>
          <div className="risk-list">
            <div className="risk">
              <span className="risk__dot risk__dot--high" />
              <div>
                <div className="risk__title">Waste Dump · Sector 14</div>
                <div className="risk__meta">High · thermal anomaly + spectral debris signature</div>
              </div>
              <span className="sev sev--high">High</span>
            </div>
            <div className="risk">
              <span className="risk__dot risk__dot--med" />
              <div>
                <div className="risk__title">Encroachment · Track 7 buffer</div>
                <div className="risk__meta">Medium · new hardscape vs 2024 baseline</div>
              </div>
              <span className="sev sev--med">Medium</span>
            </div>
            <div className="risk">
              <span className="risk__dot risk__dot--low" />
              <div>
                <div className="risk__title">Drainage blockage</div>
                <div className="risk__meta">Low · hydrology index drift along culvert C-18</div>
              </div>
              <span className="sev sev--low">Low</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
