import { _enviar, http, renovar } from "@/core/api/http";
import * as almacen from "./almacen";
import type { MotivoFin, Sesion } from "./tipos";

/** Login: el servidor deja el refresh token en una cookie HttpOnly; el access token queda en memoria. */
export async function iniciarSesion(usuario: string, contrasena: string): Promise<void> {
  almacen.iniciar(await http.post<Sesion>("/auth/login", { usuario, contrasena }));
}

/** Al arrancar (recarga, pestaña nueva): recupera la sesión desde la cookie si existe. */
export async function restaurarSesion(): Promise<void> {
  if (!(await renovar())) almacen.terminar(null);
}

/** Cierra la sesión en el servidor (revoca el refresh token) y en memoria. */
export function cerrarSesion(motivo: MotivoFin = "cerrada"): void {
  void _enviar("POST", "/auth/logout").catch(() => undefined);
  almacen.terminar(motivo);
}

export { renovar };

/**
 * Cambio de la contraseña propia. El servidor revoca las demás sesiones y devuelve un token
 * nuevo para esta (y deja una cookie de refresh nueva).
 */
export async function cambiarContrasena(contrasenaActual: string, contrasenaNueva: string): Promise<void> {
  const datos = await http.put<Partial<Sesion> | null>("/auth/contrasena", { contrasenaActual, contrasenaNueva });
  const actual = almacen.leerSesion();
  if (datos?.token && actual) almacen.iniciar({ ...actual, ...datos } as Sesion);
}
