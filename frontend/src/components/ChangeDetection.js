import React, { useState } from "react";

export default function ChangeDetection({ onToast }) {
  const [beforeUrl, setBeforeUrl] = useState("");
  const [afterUrl, setAfterUrl] = useState("");
  const [beforeFile, setBeforeFile] = useState(null);
  const [afterFile, setAfterFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [slider, setSlider] = useState(50);

  const bindFile = (kind, file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (kind === "before") {
      if (beforeUrl) URL.revokeObjectURL(beforeUrl);
      setBeforeUrl(url);
      setBeforeFile(file);
    } else {
      if (afterUrl) URL.revokeObjectURL(afterUrl);
      setAfterUrl(url);
      setAfterFile(file);
    }
  };

  const submit = async () => {
    if (!beforeFile || !afterFile) {
      onToast("Select both BEFORE and AFTER frames.", "warning");
      return;
    }
    setBusy(true);
    setProgress(0);
    setResult(null);
    const timer = window.setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 9);
        return next;
      });
    }, 200);
    try {
      const fd = new FormData();
      fd.append("before", beforeFile, beforeFile.name || "before.jpg");
      fd.append("after", afterFile, afterFile.name || "after.jpg");
      const res = await fetch("/change-detect", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Change detection unavailable");
      const data = await res.json();
      setResult(data);
      onToast("Temporal diff mosaic ready.", "success");
    } catch (e) {
      onToast(e.message || "Comparison failed", "danger");
    } finally {
      window.clearInterval(timer);
      setProgress(100);
      setBusy(false);
    }
  };

  return (
    <div className="change-detect">
      <div className="change-detect__grid">
        <div className="cd-upload">
          <div className="cd-upload__label">BEFORE</div>
          <label className="cd-drop">
            <input
              type="file"
              accept="image/*"
              className="cd-drop__input"
              onChange={(e) => bindFile("before", e.target.files && e.target.files[0])}
            />
            {beforeUrl ? <img src={beforeUrl} alt="" className="cd-drop__img" /> : <div className="cd-drop__empty">Drop baseline capture</div>}
          </label>
        </div>
        <div className="cd-upload">
          <div className="cd-upload__label">AFTER</div>
          <label className="cd-drop">
            <input
              type="file"
              accept="image/*"
              className="cd-drop__input"
              onChange={(e) => bindFile("after", e.target.files && e.target.files[0])}
            />
            {afterUrl ? <img src={afterUrl} alt="" className="cd-drop__img" /> : <div className="cd-drop__empty">Drop follow-up capture</div>}
          </label>
        </div>
      </div>

      <div className="cd-actions">
        <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
          {busy ? "Processing…" : "Run temporal diff"}
        </button>
        {busy ? (
          <div className="cd-progress">
            <div className="cd-progress__bar" style={{ width: `${progress}%` }} />
          </div>
        ) : null}
        {busy ? <div className="cd-progress__txt">Comparing satellite imagery…</div> : null}
      </div>

      {beforeUrl && afterUrl ? (
        <div className="cd-slider">
          <div className="cd-slider__viewport">
            <img src={beforeUrl} alt="" className="cd-slider__before" />
            <div className="cd-slider__after" style={{ clipPath: `inset(0 0 0 ${slider}%)` }}>
              <img src={afterUrl} alt="" className="cd-slider__after-img" />
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={slider}
              onChange={(e) => setSlider(Number(e.target.value))}
              className="cd-slider__range"
              aria-label="Before and after comparison slider"
            />
            <div className="cd-slider__divider" style={{ left: `${slider}%` }} />
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="cd-results">
          <div className="cd-results__col">
            <h3 className="cd-results__h">New signals</h3>
            {(result.new_assets || []).map((x, i) => (
              <div key={`n-${i}`} className="cd-row cd-row--new" style={{ animationDelay: `${i * 70}ms` }}>
                <span className="cd-badge cd-badge--plus">+</span>
                <div>
                  <div className="cd-row__title">
                    {x.category} · {x.label}
                  </div>
                  <div className="cd-row__detail">{x.detail}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="cd-results__col">
            <h3 className="cd-results__h">Removed / regressed</h3>
            {(result.removed_assets || []).map((x, i) => (
              <div key={`r-${i}`} className="cd-row cd-row--old" style={{ animationDelay: `${i * 70}ms` }}>
                <span className="cd-badge cd-badge--minus">−</span>
                <div>
                  <div className="cd-row__title">
                    {x.category} · {x.label}
                  </div>
                  <div className="cd-row__detail">{x.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
