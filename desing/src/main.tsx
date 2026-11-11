// Orden obligatorio: 1) estilos globales de Cloudscape, 2) tema y densidad ANTES del primer render.
import "@cloudscape-design/global-styles/index.css";
import "./estilos.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { aplicarPreferencias, leerPreferencias } from "./core/preferencias/preferencias";

aplicarPreferencias(leerPreferencias());

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
