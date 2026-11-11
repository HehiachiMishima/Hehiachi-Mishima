import { auditoriaApi } from "@/compartido/auditoria/api";
import type { AuditoriaEvento } from "@/compartido/auditoria/tipos";
import { http } from "@/core/api/http";
import type { AnaliticaAdmin } from "./tipos";

export const resumenApi = {
  analitica: (signal?: AbortSignal) => http.get<AnaliticaAdmin>("/admin/analitica", undefined, signal),

  /** Total de eventos de una o varias acciones desde `desde` (lee `total` con tamaño 1). */
  contarEventos: async (acciones: string[], desde: Date, signal?: AbortSignal): Promise<number> => {
    const p = await auditoriaApi.buscar({ accion: acciones.join(","), desde: desde.toISOString(), pagina: 1, tamano: 1 }, signal);
    return p.total;
  },

  /** Últimos fallos y denegaciones, mezclados y ordenados (máx. 5). */
  eventosSeguridad: async (signal?: AbortSignal): Promise<AuditoriaEvento[]> => {
    const [fallos, denegados] = await Promise.all(
      ["FALLO", "DENEGADO"].map((resultado) => auditoriaApi.buscar({ resultado, pagina: 1, tamano: 5 }, signal)),
    );
    return [...fallos.contenido, ...denegados.contenido].sort((a, b) => b.ocurridoEn.localeCompare(a.ocurridoEn)).slice(0, 5);
  },
};
