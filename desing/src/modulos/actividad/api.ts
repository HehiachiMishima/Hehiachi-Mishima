import { http, type Consulta } from "@/core/api/http";
import type { Pagina } from "@/core/api/tipos";
import type { ActividadUsuario, FiltroPeticiones, PeticionTraza } from "./tipos";

/** Traza de peticiones (VER_MONITOREO). Único lugar con sus URLs. */
export const actividadApi = {
  peticiones: (f: FiltroPeticiones, signal?: AbortSignal) => http.get<Pagina<PeticionTraza>>("/monitoreo/peticiones", f as Consulta, signal),
  /** `zona` (IANA) decide en qué días de calendario se agrupa porDia. */
  deUsuario: (actorId: number, dias: number, zona: string, signal?: AbortSignal) =>
    http.get<ActividadUsuario>(`/monitoreo/usuarios/${actorId}/actividad`, { dias, zona }, signal),
  cerrarSesiones: (id: number, motivo?: string) => http.post<void>(`/usuarios/${id}/sesiones/cerrar`, motivo ? { motivo } : {}),
};
