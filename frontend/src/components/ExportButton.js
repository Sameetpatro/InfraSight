import React, { useState } from "react";

export default function ExportButton({ jobId, disabled, onToast }) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const res = await fetch("/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId || null }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "assets.geojson";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onToast("GeoJSON exported successfully.", "success");
    } catch (e) {
      onToast(e.message || "Export failed", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="btn-export"
      onClick={handleClick}
      disabled={disabled || busy}
      aria-busy={busy}
    >
      {busy ? "Exporting…" : "Export GeoJSON"}
    </button>
  );
}
