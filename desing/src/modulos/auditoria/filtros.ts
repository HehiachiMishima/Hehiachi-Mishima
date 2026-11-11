import type { DateRangePickerProps } from "@cloudscape-design/components/date-range-picker";
import { ACCIONES_PRIVILEGIO } from "@/compartido/auditoria/etiquetas";
import type { FiltroAuditoria } from "@/compartido/auditoria/tipos";
import { rangoAInstantes, rangoDesdeUrl } from "@/compartido/util/rangos";

/** Estado de la página en la URL: lo que hace los enlaces compartibles desde Resumen e historiales. */
export const CLAVES_URL = ["rango", "desde", "hasta", "accion", "entidad", "entidadId", "resultado", "actorId", "q", "relacionadoCon"] as const;
export type ClaveUrl = (typeof CLAVES_URL)[number];

export interface FiltrosUi {
  rango: DateRangePickerProps.Value;
  accion: string;
  entidad: string;
  entidadId: string;
  resultado: string;
  actorId: number | null;
  q: string;
  relacionadoCon: string;
}

export function leerFiltros(p: URLSearchParams): FiltrosUi {
  return {
    rango: rangoDesdeUrl({ rango: p.get("rango"), desde: p.get("desde"), hasta: p.get("hasta") }),
    accion: p.get("accion") ?? "",
    entidad: p.get("entidad") ?? "",
    entidadId: p.get("entidadId") ?? "",
    resultado: p.get("resultado") ?? "",
    actorId: Number(p.get("actorId")) || null,
    q: p.get("q") ?? "",
    relacionadoCon: p.get("relacionadoCon") ?? "",
  };
}

export const hayFiltros = (p: URLSearchParams): boolean => CLAVES_URL.some((c) => c !== "rango" && p.get(c)) || (p.get("rango") ?? "7d") !== "7d";

export function aConsulta(f: FiltrosUi, ancla: number, pagina: number, tamano: number): FiltroAuditoria {
  return {
    ...rangoAInstantes(f.rango, ancla),
    accion: f.accion || undefined,
    entidad: f.entidad || undefined,
    entidadId: f.entidadId || undefined,
    resultado: f.resultado || undefined,
    actorId: f.actorId ?? undefined,
    q: f.q || undefined,
    relacionadoCon: f.relacionadoCon || undefined,
    pagina,
    tamano,
  };
}

/** Vistas guardadas: atajos a filtros frecuentes. */
export const VISTAS: Record<string, { etiqueta: string; filtros: Partial<Record<ClaveUrl, string>> }> = {
  "fallos-login": { etiqueta: "Fallos de inicio de sesión (24 h)", filtros: { accion: "LOGIN_FALLIDO", rango: "24h" } },
  denegados: { etiqueta: "Accesos denegados (7 días)", filtros: { resultado: "DENEGADO", rango: "7d" } },
  privilegios: { etiqueta: "Cambios de privilegios (7 días)", filtros: { accion: ACCIONES_PRIVILEGIO.join(","), rango: "7d" } },
};
