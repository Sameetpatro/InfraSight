import React, { useState } from "react";

export default function ResultDownloadButton({ resultUrl, disabled, onToast }) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy || disabled || !resultUrl) return;
    setBusy(true);
    try {
      const res = await fetch(resultUrl);
      if (!res.ok) throw new Error("Could not download marking image.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "infrasight_marking.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onToast("Marking map saved.", "success");
    } catch (e) {
      onToast(e.message || "Download failed", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className="btn-export" onClick={handleClick} disabled={disabled || busy || !resultUrl} aria-busy={busy}>
      {busy ? "Saving…" : "Download marking PNG"}
    </button>
  );
}
