import { applyDensity, applyMode, Density, Mode } from "@cloudscape-design/global-styles";

export type Tema = "claro" | "oscuro" | "sistema";
export interface Preferencias {
  tema: Tema;
  compacto: boolean;
}

const CLAVE = "preferencias-visuales";
const POR_DEFECTO: Preferencias = { tema: "sistema", compacto: false };
const consultaOscuro = window.matchMedia("(prefers-color-scheme: dark)");

export function leerPreferencias(): Preferencias {
  try {
    return { ...POR_DEFECTO, ...JSON.parse(localStorage.getItem(CLAVE) ?? "{}") };
  } catch {
    return POR_DEFECTO;
  }
}

export function guardarPreferencias(p: Preferencias): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(p));
  } catch {
    /* navegación privada: solo dura la sesión */
  }
  aplicarPreferencias(p);
}

/** Pone/quita awsui-dark-mode y awsui-compact-mode en <body>. Llamar ANTES del primer render. */
export function aplicarPreferencias(p: Preferencias): void {
  const oscuro = p.tema === "oscuro" || (p.tema === "sistema" && consultaOscuro.matches);
  applyMode(oscuro ? Mode.Dark : Mode.Light);
  applyDensity(p.compacto ? Density.Compact : Density.Comfortable);
}

consultaOscuro.addEventListener("change", () => aplicarPreferencias(leerPreferencias()));
