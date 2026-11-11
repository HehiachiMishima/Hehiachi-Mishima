import type { MotivoFin, Sesion } from "./tipos";

/**
 * Estado de la sesión fuera de React (lo leen el cliente HTTP y los componentes).
 * El access token vive SOLO en memoria: nunca en localStorage/sessionStorage.
 * React se suscribe con useSyncExternalStore (ver useSesion).
 */
export interface EstadoSesion {
  sesion: Sesion | null;
  /** Mientras se intenta recuperar la sesión con la cookie al arrancar. */
  restaurando: boolean;
  motivoFin: MotivoFin | null;
}

let estado: EstadoSesion = { sesion: null, restaurando: true, motivoFin: null };
const oyentes = new Set<() => void>();

export const leerEstado = (): EstadoSesion => estado;
export const leerSesion = (): Sesion | null => estado.sesion;

export function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

function emitir(nuevo: EstadoSesion): void {
  estado = nuevo;
  oyentes.forEach((o) => o());
}

export function iniciar(sesion: Sesion): void {
  emitir({ sesion, restaurando: false, motivoFin: null });
}

export function terminar(motivo: MotivoFin | null): void {
  emitir({ sesion: null, restaurando: false, motivoFin: motivo });
}

/** Solo para pruebas. */
export function reiniciarParaPruebas(): void {
  estado = { sesion: null, restaurando: true, motivoFin: null };
  oyentes.clear();
}
