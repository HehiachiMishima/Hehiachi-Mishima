import type { SelectProps } from "@cloudscape-design/components/select";
import { RANGOS_RELATIVOS, rangoAInstantes, rangoDesdeUrl } from "@/compartido/util/rangos";
import type { FiltroPeticiones } from "./tipos";

export const CLAVES_URL = ["rango", "desde", "hasta", "actorId", "metodo", "ruta", "estado", "lentas", "idCorrelacion"] as const;

export const ESTADOS: SelectProps.Option[] = [
  { value: "", label: "Todos los resultados" },
  { value: "2xx", label: "Correctas (2xx)" },
  { value: "errores", label: "Con error (4xx y 5xx)" },
  { value: "4xx", label: "Rechazadas (4xx)" },
  { value: "401", label: "Sin sesión (401)" },
  { value: "403", label: "Sin permiso (403)" },
  { value: "5xx", label: "Error del servidor (5xx)" },
];

export const METODOS: SelectProps.Option[] = [{ value: "", label: "Todas las operaciones" }, ...["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({ value: m, label: m }))];

/** Umbral de "lenta" (igual que el backend). */
export const LENTA_MS = 1000;

const POR_DEFECTO = "24h";

export function leerFiltros(p: URLSearchParams) {
  return {
    rango: rangoDesdeUrl({ rango: p.get("rango"), desde: p.get("desde"), hasta: p.get("hasta") }, POR_DEFECTO),
    actorId: Number(p.get("actorId")) || null,
    metodo: p.get("metodo") ?? "",
    ruta: p.get("ruta") ?? "",
    estado: p.get("estado") ?? "",
    lentas: p.get("lentas") === "1",
    idCorrelacion: p.get("idCorrelacion") ?? "",
  };
}

export type FiltrosUi = ReturnType<typeof leerFiltros>;

export const hayFiltros = (p: URLSearchParams): boolean => CLAVES_URL.some((c) => c !== "rango" && p.get(c)) || (p.get("rango") ?? POR_DEFECTO) !== POR_DEFECTO;

/** Días del resumen del usuario según el periodo (1, 7 o 30). */
export function diasDe(f: FiltrosUi): number {
  if (f.rango.type === "absolute") return 30;
  const ms = f.rango.unit === "day" ? f.rango.amount : f.rango.unit === "week" ? f.rango.amount * 7 : 1;
  return Math.min(30, Math.max(1, ms));
}

export function aConsulta(f: FiltrosUi, ancla: number, pagina: number, tamano: number): FiltroPeticiones {
  // Con id de petición se busca en todo el historial (la traza es única).
  const periodo = f.idCorrelacion ? {} : rangoAInstantes(f.rango, ancla);
  return {
    ...periodo,
    actorId: f.actorId ?? undefined,
    metodo: f.metodo || undefined,
    ruta: f.ruta || undefined,
    estado: f.estado || undefined,
    minMs: f.lentas ? LENTA_MS : undefined,
    idCorrelacion: f.idCorrelacion || undefined,
    pagina,
    tamano,
  };
}

export { RANGOS_RELATIVOS };
