import React, { useCallback, useEffect, useRef, useState } from "react";

function useImageNaturalSize(url) {
  const [size, setSize] = useState({ w: 640, h: 480 });
  useEffect(() => {
    if (!url) return;
    const img = new Image();
    img.onload = () => setSize({ w: img.naturalWidth || 640, h: img.naturalHeight || 480 });
    img.src = url;
    return () => {
      img.onload = null;
    };
  }, [url]);
  return size;
}

function hitTest(mx, my, boxes, scale, offX, offY) {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i];
    const x1 = b.bbox[0] * scale + offX;
    const y1 = b.bbox[1] * scale + offY;
    const x2 = b.bbox[2] * scale + offX;
    const y2 = b.bbox[3] * scale + offY;
    if (mx >= x1 && mx <= x2 && my >= y1 && my <= y2) return b;
  }
  return null;
}

const CAT_COLORS = {
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

export default function DetectionCanvas({ imageUrl, detections, visibleCategories, scanning }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });
  const nat = useImageNaturalSize(imageUrl);
  const animStartRef = useRef(0);
  const rafRef = useRef(0);
  const [, bump] = useState(0);

  const list = (detections || []).filter((d) => visibleCategories.has(d.category));

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = wrap.getBoundingClientRect();
    const cssW = Math.max(1, Math.floor(rect.width));
    const cssH = Math.max(1, Math.floor(rect.width * (nat.h / nat.w)));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const scale = cssW / nat.w;
    const offX = 0;
    const offY = 0;

    const now = performance.now();
    if (!animStartRef.current) animStartRef.current = now;
    const base = animStartRef.current;

    list.forEach((d, idx) => {
      const delay = idx * 150;
      const tRaw = (now - base - delay) / 420;
      const t = Math.max(0, Math.min(1, tRaw));
      const x1o = d.bbox[0];
      const y1o = d.bbox[1];
      const x2o = d.bbox[2];
      const y2o = d.bbox[3];
      const cx = (x1o + x2o) / 2;
      const cy = (y1o + y2o) / 2;
      const w = (x2o - x1o) * t;
      const h = (y2o - y1o) * t;
      const x1 = (cx - w / 2) * scale + offX;
      const y1 = (cy - h / 2) * scale + offY;
      const x2 = (cx + w / 2) * scale + offX;
      const y2 = (cy + h / 2) * scale + offY;

      const col = CAT_COLORS[d.category] || "#00D4FF";
      const isHover = hover && hover.id === d.id;
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = isHover ? 2.4 : 1.6;
      ctx.shadowColor = isHover ? col : "rgba(0,0,0,0)";
      ctx.shadowBlur = isHover ? 14 : 0;
      ctx.beginPath();
      ctx.rect(x1, y1, x2 - x1, y2 - y1);
      ctx.stroke();
      ctx.restore();

      if (t > 0.15) {
        const pct = Math.round((d.confidence || 0) * 100);
        const label = `${d.category} ${pct}%`;
        ctx.save();
        ctx.font = "600 11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
        const padX = 6;
        const padY = 4;
        const tw = ctx.measureText(label).width;
        const lx = x1;
        const ly = Math.max(18, y1 - 6);
        ctx.fillStyle = col;
        ctx.globalAlpha = Math.min(1, (t - 0.15) / 0.35);
        ctx.fillRect(lx, ly - 18, tw + padX * 2, 22);
        ctx.fillStyle = "#F8FAFF";
        ctx.globalAlpha = 1;
        ctx.fillText(label, lx + padX, ly - 2);
        ctx.restore();
      }
    });
  }, [list, nat.h, nat.w, hover]);

  useEffect(() => {
    animStartRef.current = performance.now();
  }, [detections, imageUrl]);

  useEffect(() => {
    const loop = () => {
      redraw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [redraw]);

  useEffect(() => {
    const onResize = () => bump((x) => x + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onMove = (e) => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas || scanning) return;
    const r = wrap.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const cssW = r.width;
    const cssH = (r.width * nat.h) / nat.w;
    const scale = cssW / nat.w;
    const hit = hitTest(mx, my, list, scale, 0, 0);
    setHover(hit);
    setTipPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const onLeave = () => setHover(null);

  return (
    <div className="detection-canvas">
      <div className="detection-canvas__frame" ref={wrapRef} onMouseMove={onMove} onMouseLeave={onLeave}>
        {imageUrl ? (
          <img className="detection-canvas__img" src={imageUrl} alt="Uploaded preview" draggable={false} />
        ) : (
          <div className="detection-canvas__placeholder" role="region" aria-label="Detection viewport">
            <div className="detection-canvas__placeholder-k">Detection viewport</div>
            <p className="detection-canvas__placeholder-lead">This panel shows your uploaded frame with bounding boxes and labels after inference.</p>
            <p className="detection-canvas__placeholder-hint">Upload an image in the section above to begin.</p>
          </div>
        )}
        <canvas ref={canvasRef} className="detection-canvas__layer" />
        {scanning ? <div className="scan-line" aria-hidden="true" /> : null}
        {scanning ? (
          <div className="scan-caption">
            Scanning… <span className="scan-caption__sub">(model inference running)</span>
          </div>
        ) : null}
        {hover ? (
          <div
            className="det-tooltip"
            style={{ left: Math.min(tipPos.x + 12, (wrapRef.current?.clientWidth || 0) - 220), top: tipPos.y + 12 }}
          >
            <div className="det-tooltip__title">{hover.category}</div>
            <div className="det-tooltip__row">
              <span>Confidence</span>
              <strong>{Math.round((hover.confidence || 0) * 100)}%</strong>
            </div>
            <div className="det-tooltip__row">
              <span>Area</span>
              <strong>{hover.area_sqm} m²</strong>
            </div>
            <div className="det-tooltip__row">
              <span>Asset ID</span>
              <strong>#{hover.id}</strong>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
