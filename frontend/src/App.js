import React, { useCallback, useEffect, useMemo, useState } from "react";
import { applyTheme, getStoredTheme } from "./theme";
import HeroThreeJS from "./components/HeroThreeJS";
import Navbar from "./components/Navbar";
import UploadPanel from "./components/UploadPanel";
import CategoryFilter from "./components/CategoryFilter";
import DetectionCanvas from "./components/DetectionCanvas";
import SummaryPanel from "./components/SummaryPanel";
import MapView from "./components/MapView";
import ChangeDetection from "./components/ChangeDetection";
import Analytics from "./components/Analytics";
import { ToastStack, useToast } from "./components/Toast";

const ALL_CATEGORIES = [
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

export default function App() {
  const [theme, setTheme] = useState(() => getStoredTheme());
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState("detect");
  const [contentOn, setContentOn] = useState(true);

  const [jobId, setJobId] = useState("");
  const [payload, setPayload] = useState(null);
  const [summary, setSummary] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  const [visible, setVisible] = useState(() => new Set(ALL_CATEGORIES));

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

  const goTab = (t) => {
    if (t === activeTab) return;
    setContentOn(false);
    window.setTimeout(() => {
      setActiveTab(t);
      setContentOn(true);
    }, 150);
  };

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
        const buildLocal = () => ({
          job_id: data.job_id,
          processed_at: data.processed_at,
          categories: ALL_CATEGORIES.map((name) => {
            const items = (data.detections || []).filter((d) => d.category === name);
            const area = items.reduce((a, b) => a + (b.area_sqm || 0), 0);
            return { category: name, count: items.length, area_sqm: area };
          }),
        });
        try {
          const res = await fetch(`/summary/${data.job_id}`);
          if (res.ok) {
            const s = await res.json();
            setSummary(s);
          } else {
            pushToast("Summary endpoint returned an error — using client-side rollup.", "warning");
            setSummary(buildLocal());
          }
        } catch {
          pushToast("Summary service unreachable — showing local rollup.", "warning");
          setSummary(buildLocal());
        }
      }
    },
    [pushToast]
  );

  const toggleCategory = (cat) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      if (next.size === 0) next.add(cat);
      return next;
    });
  };

  const detections = payload && payload.detections ? payload.detections : [];
  const meta = useMemo(() => {
    if (!payload) return { image_width: 640, image_height: 480 };
    return { image_width: payload.image_width, image_height: payload.image_height };
  }, [payload]);

  return (
    <div className={`app-root ${ready ? "app-root--ready" : ""}`}>
      <ToastStack toasts={toasts} onDismiss={removeToast} />
      <HeroThreeJS theme={theme} />
      <Navbar
        theme={theme}
        onToggleTheme={handleTheme}
        activeTab={activeTab}
        onTab={goTab}
        jobId={jobId}
        onToast={pushToast}
      />
      <main className="main">
        <div className={`tab-panel ${contentOn ? "tab-panel--in" : "tab-panel--out"}`}>
          {activeTab === "detect" ? (
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
                <CategoryFilter detections={detections} visible={visible} onToggle={toggleCategory} />
                <DetectionCanvas
                  imageUrl={previewUrl}
                  detections={detections}
                  visibleCategories={visible}
                  scanning={scanning}
                />
              </div>
              <div className="detect-layout__full">
                <SummaryPanel summary={summary} visible={!!summary && !scanning} />
              </div>
            </section>
          ) : null}

          {activeTab === "map" ? (
            <section className="section-block">
              {!jobId ? (
                <div className="empty-state">Run a detection first to project assets on the Delhi basemap.</div>
              ) : (
                <MapView theme={theme} detections={detections} meta={meta} onToast={pushToast} />
              )}
            </section>
          ) : null}

          {activeTab === "change" ? (
            <section className="section-block">
              <ChangeDetection onToast={pushToast} />
            </section>
          ) : null}

          {activeTab === "analytics" ? (
            <section className="section-block">
              <Analytics detections={detections} active={contentOn && activeTab === "analytics"} />
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
