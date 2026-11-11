import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ENTORNO } from "@/config/entorno";
import { monitoreoApi } from "./api";

/** Claves de caché del módulo (jerárquicas: invalidar ["monitoreo"] refresca todo). */
export const claves = {
  todo: ["monitoreo"] as const,
  resumen: (m: number) => ["monitoreo", "resumen", m] as const,
  serie: (m: number) => ["monitoreo", "serie", m] as const,
  rutas: (m: number) => ["monitoreo", "rutas", m] as const,
  activos: (m: number) => ["monitoreo", "activos", m] as const,
  incidencias: ["monitoreo", "incidencias"] as const,
};

/** Opciones comunes: refresco en vivo y sin parpadeo al cambiar de ventana (se muestran los datos previos). */
const vivo = (enVivo: boolean) => ({
  refetchInterval: enVivo ? ENTORNO.monitoreo.intervaloMs : (false as const),
  refetchIntervalInBackground: false,
  placeholderData: keepPreviousData,
  staleTime: 5_000,
});

export const useResumen = (minutos: number, enVivo: boolean) =>
  useQuery({ queryKey: claves.resumen(minutos), queryFn: ({ signal }) => monitoreoApi.resumen(minutos, signal), ...vivo(enVivo) });

export const useSerie = (enVivo: boolean) =>
  useQuery({ queryKey: claves.serie(60), queryFn: ({ signal }) => monitoreoApi.serie(60, signal), ...vivo(enVivo) });

export const useRutas = (minutos: number, enVivo: boolean) =>
  useQuery({ queryKey: claves.rutas(minutos), queryFn: ({ signal }) => monitoreoApi.rutas(minutos, signal), ...vivo(enVivo) });

export const useUsuariosActivos = (enVivo: boolean) =>
  useQuery({ queryKey: claves.activos(15), queryFn: ({ signal }) => monitoreoApi.usuariosActivos(15, signal), ...vivo(enVivo) });

export const useIncidencias = (enVivo: boolean) =>
  useQuery({ queryKey: claves.incidencias, queryFn: ({ signal }) => monitoreoApi.incidencias(signal), ...vivo(enVivo) });
