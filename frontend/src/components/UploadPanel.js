import React, { useCallback, useEffect, useRef, useState } from "react";

export default function UploadPanel({ onResult, onScanning, onToast, onPreviewUrl }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (onPreviewUrl) onPreviewUrl(preview);
  }, [preview, onPreviewUrl]);
  const runDetect = useCallback(
    async (file) => {
      if (!file || !file.type.startsWith("image/")) {
        onToast("Please select a valid image file.", "warning");
        return;
      }
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setLoading(true);
      onScanning(true);
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append("image", file, file.name || "upload.jpg");
        const res = await fetch("/detect", { method: "POST", body: fd });
        if (!res.ok) throw new Error("Scan service unavailable");
        const data = await res.json();
        onResult(data);
        onToast("Marking map ready.", "success");
      } catch (e) {
        onToast(e.message || "Detection failed", "danger");
        onResult(null);
      } finally {
        setLoading(false);
        onScanning(false);
        setBusy(false);
      }
    },
    [onResult, onScanning, onToast]
  );

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) runDetect(f);
  };

  const onPick = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) runDetect(f);
  };

  return (
    <div className="upload-panel">
      <div className="upload-stack">
        <div
          className={`upload-zone ${drag ? "upload-zone--drag" : ""}`}
          onDragEnter={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current && inputRef.current.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current && inputRef.current.click();
            }
          }}
        >
          <input ref={inputRef} type="file" accept="image/*" className="upload-zone__input" onChange={onPick} />
          <div className="upload-zone__core">
            <svg className="upload-zone__icon" viewBox="0 0 24 24" width="44" height="44" aria-hidden="true">
              <path
                fill="currentColor"
                d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"
              />
            </svg>
            <div className="upload-zone__title">Drop aerial or satellite image</div>
            <div className="upload-zone__hint">PNG / JPG · PixelMapINT fusion (SegFormer + optional road / water / building + waste)</div>
          </div>
          {drag ? <div className="upload-zone__drop-label">DROP TO SCAN</div> : null}
        </div>

        <div className="upload-preview">
          {busy && !preview ? <div className="skeleton skeleton--hero" /> : null}
          {preview ? (
            <div className="upload-preview__inner">
              <img className={`upload-preview__img ${loading ? "upload-preview__img--ghost" : ""}`} src={preview} alt="" />
              {loading ? (
                <div className="upload-preview__infer" role="status" aria-live="polite">
                  <div className="orbit orbit--infer" aria-hidden="true">
                    <div className="orbit__ring" />
                  </div>
                  <p className="upload-preview__infer-text">Running model inference…</p>
                  <p className="upload-preview__infer-sub">GPU optional · weights in model/PixelMapINT/model/</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="upload-preview__empty">No frame buffered</div>
          )}
        </div>
      </div>
    </div>
  );
}
