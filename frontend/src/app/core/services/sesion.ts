import { Service, computed, signal } from '@angular/core';
import { CONFIG } from '../config/configuracion';
import { Sesion, Usuario } from '../models';

const CLAVE = CONFIG.almacenamiento.sesion;

/**
 * Estado de la sesión autenticada.
 *
 * Decisión de seguridad: el access token (JWT de vida corta) vive SOLO en
 * memoria; nunca en sessionStorage ni localStorage, así un XSS no encuentra
 * un token persistido. Al recargar o abrir otra pestaña la sesión se
 * restaura con POST /auth/refresh, que usa el refresh token de una cookie
 * HttpOnly (Path=/api/auth, SameSite=Strict) que el JavaScript no puede leer.
 */
@Service()
export class SesionStore {
  private readonly _sesion = signal<Sesion | null>(this.limpiarHeredada());
  private readonly _permisos = computed<readonly string[]>(() => this._sesion()?.permisos ?? []);

  readonly sesion = this._sesion.asReadonly();
  readonly permisos = this._permisos;
  readonly usuario = computed(() => this._sesion()?.usuario ?? null);
  readonly autenticado = computed(() => this.esVigente(this._sesion()));

  guardar(sesion: Sesion): void {
    this._sesion.set(sesion);
  }

  /** Sustituye identidad y permisos por los vigentes en el servidor (sin tocar el token). */
  actualizarVigente(usuario: Usuario, permisos: string[]): void {
    const actual = this._sesion();
    if (actual) {
      this.guardar({ ...actual, usuario, permisos });
    }
  }

  /** Sustituye el token (p. ej. tras cambiar la contraseña, que revoca los anteriores). */
  actualizarToken(token: string, expiraEn?: string): void {
    const actual = this._sesion();
    if (actual) {
      this.guardar({ ...actual, token, expiraEn: expiraEn ?? actual.expiraEn });
    }
  }

  limpiar(): void {
    this._sesion.set(null);
    this.limpiarHeredada();
  }

  tienePermiso(permiso: string): boolean {
    return this._permisos().includes(permiso);
  }

  tieneTodos(permisos: readonly string[]): boolean {
    const actuales = this._permisos();
    return permisos.every((permiso) => actuales.includes(permiso));
  }

  /** true si el token sigue dentro de su vigencia según el reloj del cliente. */
  esVigente(sesion: Sesion | null): boolean {
    if (!sesion?.token) {
      return false;
    }
    if (sesion.expiraEn) {
      return new Date(sesion.expiraEn).getTime() > Date.now();
    }
    return true;
  }

  /** Borra tokens que versiones anteriores guardaban en el navegador. */
  private limpiarHeredada(): null {
    try {
      sessionStorage.removeItem(CLAVE);
      localStorage.removeItem(CLAVE);
    } catch {
      /* almacenamiento no disponible */
    }
    return null;
  }
}
