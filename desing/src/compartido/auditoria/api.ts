import { http, type Consulta } from "@/core/api/http";
import type { Pagina } from "@/core/api/tipos";
import type { AuditoriaEvento, FiltroAuditoria } from "./tipos";

/** Lectura de la bitácora (VER_AUDITORIA). Compartida: la usan Auditoría, Resumen y los historiales. */
export const auditoriaApi = {
  buscar: (f: FiltroAuditoria, signal?: AbortSignal) => http.get<Pagina<AuditoriaEvento>>("/auditoria", f as Consulta, signal),
  obtener: (id: number, signal?: AbortSignal) => http.get<AuditoriaEvento>(`/auditoria/${id}`, undefined, signal),
  exportar: (f: FiltroAuditoria) => http.descargar("/auditoria/exportar", { ...f, pagina: undefined, tamano: undefined } as Consulta),
};
