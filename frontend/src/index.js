import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/theme.css";
import "./styles/animations.css";
import "./styles/main.css";
import App from "./App";
import { applyTheme, getStoredTheme } from "./theme";

applyTheme(getStoredTheme());

const el = document.getElementById("root");
const root = createRoot(el);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
