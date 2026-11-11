import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { auditoriaApi } from "@/compartido/auditoria/api";
import type { FiltroAuditoria } from "@/compartido/auditoria/tipos";

export const claves = { todo: ["auditoria"] as const };

/** Página de eventos; mientras llega la siguiente se muestra la anterior (sin parpadeo). */
export const useEventos = (f: FiltroAuditoria) =>
  useQuery({ queryKey: ["auditoria", "eventos", f], queryFn: ({ signal }) => auditoriaApi.buscar(f, signal), placeholderData: keepPreviousData });

export const useEvento = (id: number | null) =>
  useQuery({ queryKey: ["auditoria", "evento", id], queryFn: ({ signal }) => auditoriaApi.obtener(id!, signal), enabled: id !== null });

export const exportarAuditoria = auditoriaApi.exportar;
