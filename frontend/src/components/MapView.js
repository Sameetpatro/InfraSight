import L from "leaflet";
import React, { useEffect, useRef } from "react";

const COLORS = {
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

function bboxToLatLng(bbox, imgW, imgH) {
  const centerLat = 28.6139;
  const centerLon = 77.2090;
  const x1 = bbox[0];
  const y1 = bbox[1];
  const x2 = bbox[2];
  const y2 = bbox[3];
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const w = imgW || 640;
  const h = imgH || 480;
  const lat = centerLat + ((cy / h) - 0.5) * 0.04;
  const lon = centerLon + ((cx / w) - 0.5) * 0.04;
  return [lat, lon];
}

export default function MapView({ theme, detections, meta, onToast }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const markersRef = useRef([]);
  const clockRef = useRef(null);

  useEffect(() => {
    const el = clockRef.current;
    const tick = () => {
      if (!el) return;
      const d = new Date();
      el.textContent = d.toLocaleTimeString(undefined, { hour12: false });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([28.6139, 77.209], 13);
    mapRef.current = map;
    const dark = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 20,
    });
    const light = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 20,
    });
    const base = theme === "dark" ? dark : light;
    base.addTo(map);
    layerRef.current = { dark, light, active: base };
    setTimeout(() => map.invalidateSize(), 120);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const pack = layerRef.current;
    const map = mapRef.current;
    if (!pack || !map) return;
    map.removeLayer(pack.active);
    const next = theme === "dark" ? pack.dark : pack.light;
    next.addTo(map);
    pack.active = next;
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];
    const imgW = meta && meta.image_width ? meta.image_width : 640;
    const imgH = meta && meta.image_height ? meta.image_height : 480;
    (detections || []).forEach((d) => {
      const color = COLORS[d.category] || "#00D4FF";
      const latlng = bboxToLatLng(d.bbox, imgW, imgH);
      const html = `<div class="map-pulse" style="--mc:${color}"><span class="map-pulse__dot"></span><span class="map-pulse__ring"></span></div>`;
      const icon = L.divIcon({
        className: "map-marker-wrap",
        html,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const m = L.marker(latlng, { icon }).addTo(map);
      const pct = Math.round((d.confidence || 0) * 100);
      const popupHtml = `
        <div class="map-popup">
          <div class="map-popup__title">${d.category}</div>
          <div class="map-popup__bar"><span style="width:${pct}%"></span></div>
          <div class="map-popup__meta">Confidence <strong>${pct}%</strong></div>
          <div class="map-popup__meta">Area <strong>${d.area_sqm} m²</strong></div>
          <button type="button" class="map-popup__btn" data-flag="1">Flag Asset</button>
        </div>`;
      m.bindPopup(popupHtml, { className: "map-popup-shell", maxWidth: 260 });
      m.on("popupopen", () => {
        const el = m.getPopup().getElement();
        if (!el) return;
        const btn = el.querySelector("button[data-flag]");
        if (!btn) return;
        const handler = () => onToast(`Asset #${d.id} flagged for divisional review.`, "success");
        btn.addEventListener("click", handler, { once: true });
      });
      markersRef.current.push(m);
    });
  }, [detections, meta, onToast]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => clearTimeout(t);
  }, [detections]);

  const total = (detections || []).length;
  const area = (detections || []).reduce((s, d) => s + (d.area_sqm || 0), 0);

  return (
    <div className="map-view">
      <div className="map-view__stats">
        <div className="map-stat">
          <span className="map-stat__k">Total assets</span>
          <span className="map-stat__v">{total}</span>
        </div>
        <div className="map-stat">
          <span className="map-stat__k">Coverage area</span>
          <span className="map-stat__v">{area.toLocaleString()} m²</span>
        </div>
        <div className="map-stat map-stat--clock">
          <span className="map-stat__k">IST clock</span>
          <span className="map-stat__v" ref={clockRef}>
            --:--:--
          </span>
        </div>
      </div>
      <div ref={mapEl} className="map-view__canvas" />
      <div className="map-legend">
        <div className="map-legend__title">Legend</div>
        {Object.keys(COLORS).map((k) => (
          <div key={k} className="map-legend__row">
            <span className="map-legend__dot" style={{ background: COLORS[k] }} />
            <span>{k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
