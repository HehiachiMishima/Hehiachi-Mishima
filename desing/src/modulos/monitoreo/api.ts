import { http } from "@/core/api/http";
import type { Incidencias, Presencia, PuntoMonitoreo, ResumenMonitoreo, RutaMonitoreo } from "./tipos";

/** Endpoints de /api/monitoreo (requieren VER_MONITOREO). Único lugar con sus URLs. */
export const monitoreoApi = {
  resumen: (minutos: number, signal?: AbortSignal) => http.get<ResumenMonitoreo>("/monitoreo/resumen", { minutos }, signal),
  serie: (minutos: number, signal?: AbortSignal) => http.get<PuntoMonitoreo[]>("/monitoreo/serie", { minutos }, signal),
  rutas: (minutos: number, signal?: AbortSignal) => http.get<RutaMonitoreo[]>("/monitoreo/rutas", { minutos }, signal),
  incidencias: (signal?: AbortSignal) => http.get<Incidencias>("/monitoreo/incidencias", undefined, signal),
  usuariosActivos: (minutos: number, signal?: AbortSignal) => http.get<Presencia[]>("/monitoreo/usuarios-activos", { minutos }, signal),
};
