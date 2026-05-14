import React from "react";
import ResultDownloadButton from "./ExportButton";

export default function Navbar({ theme, onToggleTheme, jobId, resultUrl, onToast }) {
  return (
    <header className="navbar">
      <div className="navbar__inner">
        <div className="navbar__brand">
          <svg className="navbar__logo" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4zm0 3.2L7.5 7.1V12c0 3.7 2.4 7 4.5 8 2.1-1 4.5-4.3 4.5-8V7.1L12 5.2z"
            />
          </svg>
          <span className="navbar__word">InfraSight</span>
        </div>

        <div className="navbar__tagline">PixelMapINT obstacle marking</div>

        <div className="navbar__actions">
          <button
            type="button"
            className={`theme-toggle ${theme === "dark" ? "theme-toggle--dark" : "theme-toggle--light"}`}
            onClick={onToggleTheme}
            aria-label="Toggle color theme"
          >
            <span className="theme-toggle__icon theme-toggle__sun" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path
                  fill="currentColor"
                  d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zm10.48 0l1.79-1.79 1.41 1.41-1.79 1.8-1.41-1.42zM12 4V1h-1v3h1zm0 19v-3h-1v3h1zm8-9h3v-1h-3v1zM1 12v1h3v-1H1zm18.36-5.64l1.41-1.41 1.41 1.41-1.41 1.41-1.41-1.41zM4.22 19.78l1.41-1.41 1.41 1.41-1.41 1.41-1.41-1.41zm0-15.56L2.81 2.81 4.22 4.22l1.41-1.41-1.41-1.41zm15.56 0l1.41-1.41 1.41 1.41-1.41 1.41-1.41-1.41zM12 6a6 6 0 100 12 6 6 0 000-12z"
                />
              </svg>
            </span>
            <span className="theme-toggle__icon theme-toggle__moon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M9.37 5.51A7 7 0 1018.49 15a8 8 0 01-9.12-9.49z" />
              </svg>
            </span>
          </button>
          <ResultDownloadButton resultUrl={resultUrl} disabled={!jobId} onToast={onToast} />
        </div>
      </div>
    </header>
  );
}
