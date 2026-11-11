/** Qué hacer cuando el access token está por vencer. Lógica pura (sin timers ni React): se prueba aparte. */
export type Decision = "renovar" | "avisar" | "cerrar";

export function decidirRenovacion(p: { ahora: number; vence: number; ultimaActividad: number; inactividadMaxMs: number }): Decision {
  if (p.ahora - p.ultimaActividad < p.inactividadMaxMs) return "renovar";
  return p.vence <= p.ahora ? "cerrar" : "avisar";
}
