import React, { useEffect, useRef, useState } from "react";

export default function MarkingCanvas({ sourceUrl, resultUrl, scanning }) {
  const wrapRef = useRef(null);
  const [, bump] = useState(0);

  useEffect(() => {
    const onResize = () => bump((x) => x + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="marking-canvas">
      <div className="marking-canvas__frame" ref={wrapRef}>
        <div className="marking-canvas__pair">
          <figure className="marking-canvas__fig">
            <figcaption className="marking-canvas__cap">Original</figcaption>
            {sourceUrl ? (
              <img className="marking-canvas__img" src={sourceUrl} alt="" draggable={false} />
            ) : (
              <div className="marking-canvas__placeholder">Upload an image to preview the frame.</div>
            )}
          </figure>
          <figure className="marking-canvas__fig">
            <figcaption className="marking-canvas__cap">Obstacle marking map</figcaption>
            {resultUrl ? (
              <img className="marking-canvas__img" src={resultUrl} alt="Marking overlay from PixelMapINT" draggable={false} />
            ) : (
              <div className="marking-canvas__placeholder">
                {scanning ? "Running SegFormer…" : "Marked overlay appears here after inference."}
              </div>
            )}
          </figure>
        </div>
        {scanning ? (
          <div className="scan-caption marking-canvas__scan">
            Scanning… <span className="scan-caption__sub">(PixelMapINT / SegFormer)</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
