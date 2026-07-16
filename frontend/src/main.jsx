import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "maplibre-gl/dist/maplibre-gl.css";
import "../themes/dark.css";
import "../themes/light.css";
import "../themes/neon.css";
import "../themes/blue.css";
import "../themes/green.css";
import "../themes/red.css";
import "../themes/forest.css";
import "../themes/sunset.css";
import "./styles.css";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
