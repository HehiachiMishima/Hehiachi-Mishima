import { useQueries, useQuery } from "@tanstack/react-query";
import { ACCIONES_PRIVILEGIO } from "@/compartido/auditoria/etiquetas";
import { PERMISOS } from "@/core/sesion/permisos";
import { useSesion } from "@/core/sesion/useSesion";
import { resumenApi } from "./api";
import type { IndicadorSeguridad } from "./tipos";

export const claves = { todo: ["resumen"] as const };

export const useAnalitica = () => useQuery({ queryKey: ["resumen", "analitica"], queryFn: ({ signal }) => resumenApi.analitica(signal) });

const HORA = 3_600_000;
const SEGURIDAD = [
  { id: "fallidos", titulo: "Inicios de sesión fallidos (24 h)", acciones: ["LOGIN_FALLIDO"], horas: 24, enlace: "/auditoria?accion=LOGIN_FALLIDO&rango=24h" },
  { id: "denegados", titulo: "Accesos denegados (7 días)", acciones: ["ACCESO_DENEGADO"], horas: 168, enlace: "/auditoria?accion=ACCESO_DENEGADO&rango=7d" },
  { id: "privilegios", titulo: "Cambios de privilegios (7 días)", acciones: ACCIONES_PRIVILEGIO, horas: 168, enlace: "/auditoria?vista=privilegios" },
];

/** Indicadores de seguridad de la bitácora; vacío si la sesión no puede ver la auditoría. */
export function useIndicadoresSeguridad(): IndicadorSeguridad[] {
  const { puede } = useSesion();
  const habilitado = puede(PERMISOS.VER_AUDITORIA);
  const resultados = useQueries({
    queries: SEGURIDAD.map((d) => ({
      queryKey: ["resumen", "seguridad", d.id],
      queryFn: ({ signal }: { signal: AbortSignal }) => resumenApi.contarEventos(d.acciones, new Date(Date.now() - d.horas * HORA), signal),
      enabled: habilitado,
    })),
  });
  if (!habilitado) return [];
  return SEGURIDAD.map((d, i) => ({ id: d.id, titulo: d.titulo, enlace: d.enlace, valor: resultados[i].isError ? Number.NaN : resultados[i].data }));
}

export function useEventosSeguridad() {
  const { puede } = useSesion();
  return useQuery({ queryKey: ["resumen", "eventos"], queryFn: ({ signal }) => resumenApi.eventosSeguridad(signal), enabled: puede(PERMISOS.VER_AUDITORIA) });
}
