import React, { useCallback, useEffect, useMemo, useState } from "react";
import { applyTheme, getStoredTheme } from "./theme";
import HeroThreeJS from "./components/HeroThreeJS";
import Navbar from "./components/Navbar";
import UploadPanel from "./components/UploadPanel";
import MarkingCanvas from "./components/MarkingCanvas";
import SummaryPanel from "./components/SummaryPanel";
import { ToastStack, useToast } from "./components/Toast";

export default function App() {
  const [theme, setTheme] = useState(() => getStoredTheme());
  const [ready, setReady] = useState(false);

  const [jobId, setJobId] = useState("");
  const [payload, setPayload] = useState(null);
  const [summary, setSummary] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  const { toasts, pushToast, removeToast } = useToast();

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  const handleTheme = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      applyTheme(next);
      return next;
    });
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const onDetectResult = useCallback(
    async (data) => {
      if (!data) {
        setPayload(null);
        setJobId("");
        setSummary(null);
        return;
      }
      setPayload(data);
      setJobId(data.job_id || "");
      setSummary(null);
      if (data.job_id) {
        try {
          const locKey = data.location_hash || data.job_id;
          const res = await fetch(`/summary/${encodeURIComponent(locKey)}`);
          if (res.ok) {
            const s = await res.json();
            setSummary(s);
          } else {
            pushToast("Summary endpoint returned an error — using latest scan stats only.", "warning");
            setSummary({
              job_id: data.job_id,
              processed_at: data.processed_at,
              marking_stats: data.marking_stats || [],
              spatial_intelligence: data.spatial_intelligence,
              change_detection: data.change_detection,
            });
          }
        } catch {
          pushToast("Summary service unreachable — showing latest scan stats only.", "warning");
          setSummary({
            job_id: data.job_id,
            processed_at: data.processed_at,
            marking_stats: data.marking_stats || [],
            spatial_intelligence: data.spatial_intelligence,
            change_detection: data.change_detection,
          });
        }
      }
    },
    [pushToast]
  );

  const resultUrl = useMemo(() => {
    if (!payload || !payload.result_url) return "";
    const u = payload.result_url;
    if (u.startsWith("http")) return u;
    return u;
  }, [payload]);

  const markingStats = useMemo(() => {
    if (summary && summary.marking_stats && summary.marking_stats.length) return summary.marking_stats;
    if (payload && payload.marking_stats) return payload.marking_stats;
    return [];
  }, [summary, payload]);

  const spatialIntelligence = useMemo(() => {
    if (payload && payload.spatial_intelligence) return payload.spatial_intelligence;
    if (summary && summary.spatial_intelligence) return summary.spatial_intelligence;
    return null;
  }, [payload, summary]);

  const changeDetection = useMemo(() => {
    if (payload && Object.prototype.hasOwnProperty.call(payload, "change_detection")) return payload.change_detection;
    if (summary && Object.prototype.hasOwnProperty.call(summary, "change_detection")) return summary.change_detection;
    return null;
  }, [payload, summary]);

  return (
    <div className={`app-root ${ready ? "app-root--ready" : ""}`}>
      <ToastStack toasts={toasts} onDismiss={removeToast} />
      <HeroThreeJS theme={theme} />
      <Navbar theme={theme} onToggleTheme={handleTheme} jobId={jobId} resultUrl={resultUrl} onToast={pushToast} />
      <main className="main">
        <div className="tab-panel tab-panel--in">
          <section className="detect-layout">
            <div className="detect-layout__upload">
              <UploadPanel
                onResult={onDetectResult}
                onScanning={setScanning}
                onToast={pushToast}
                onPreviewUrl={setPreviewUrl}
              />
            </div>
            <div className="detect-layout__workspace">
              <MarkingCanvas sourceUrl={previewUrl} resultUrl={resultUrl} scanning={scanning} />
            </div>
            <div className="detect-layout__full">
              <SummaryPanel
                markingStats={markingStats}
                visible={!!payload && !scanning}
                modelNote={payload && payload.model_note}
                spatialIntelligence={spatialIntelligence}
                changeDetection={changeDetection}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
