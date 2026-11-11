import { useCallback, useEffect, useRef, useState } from "react";
import { ENTORNO } from "@/config/entorno";
import { cerrarSesion, renovar } from "./autenticacion";
import { decidirRenovacion } from "./decision";
import type { Sesion } from "./tipos";

const EVENTOS_ACTIVIDAD = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * Ciclo de vida del access token:
 * - poco antes de vencer, si hubo actividad reciente, lo renueva en silencio;
 * - si no, devuelve `aviso` (hora de cierre) para preguntar "¿Sigues ahí?";
 * - al vencer sin renovar, cierra la sesión (también la del servidor).
 */
export function useVigilanteSesion(sesion: Sesion | null) {
  const [aviso, setAviso] = useState<Date | null>(null);
  const ultimaActividad = useRef(0);
  const renovando = useRef(false);

  useEffect(() => {
    const marcar = () => (ultimaActividad.current = Date.now());
    marcar(); // abrir la app cuenta como actividad
    EVENTOS_ACTIVIDAD.forEach((e) => document.addEventListener(e, marcar, { passive: true, capture: true }));
    return () => EVENTOS_ACTIVIDAD.forEach((e) => document.removeEventListener(e, marcar, { capture: true }));
  }, []);

  const renovarAhora = useCallback(() => {
    renovando.current = true;
    void renovar().then((ok) => {
      renovando.current = false;
      if (!ok) cerrarSesion("expirada");
    });
  }, []);

  useEffect(() => {
    if (!sesion) return;
    const vence = new Date(sesion.expiraEn).getTime();
    const decidir = () => {
      if (renovando.current) return;
      const d = decidirRenovacion({
        ahora: Date.now(),
        vence,
        ultimaActividad: ultimaActividad.current,
        inactividadMaxMs: ENTORNO.sesion.inactividadMaxMs,
      });
      if (d === "renovar") renovarAhora();
      else if (d === "cerrar") cerrarSesion("expirada");
      else setAviso(new Date(vence));
    };
    const alVencer = () => !renovando.current && cerrarSesion("expirada");
    // Tras suspender el equipo los temporizadores llegan tarde: se re-evalúa al volver.
    const alVolver = () => document.visibilityState === "visible" && vence - Date.now() <= ENTORNO.sesion.avisoMs && decidir();

    const t1 = setTimeout(decidir, Math.max(0, vence - Date.now() - ENTORNO.sesion.avisoMs));
    const t2 = setTimeout(alVencer, Math.max(0, vence - Date.now()));
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      document.removeEventListener("visibilitychange", alVolver);
      setAviso(null);
    };
  }, [sesion, renovarAhora]);

  return {
    aviso,
    seguirConectado: () => {
      setAviso(null);
      ultimaActividad.current = Date.now();
      renovarAhora();
    },
    salir: () => {
      setAviso(null);
      cerrarSesion();
    },
  };
}
