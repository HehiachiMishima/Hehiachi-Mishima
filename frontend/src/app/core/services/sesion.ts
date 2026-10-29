import { Service, computed, signal } from '@angular/core';
import { CONFIG } from '../config/configuracion';
import { Sesion, Usuario } from '../models';

const CLAVE = CONFIG.almacenamiento.sesion;

/**
 * Estado de la sesión autenticada.
 *
 * Decisión de seguridad: el JWT se guarda en `sessionStorage` (no en
 * `localStorage`). Queda limitado a la pestaña y se borra al cerrarla, lo que
 * reduce la ventana de robo ante un XSS o un equipo compartido. El coste es
 * que cada pestaña nueva pide iniciar sesión. Una cookie HttpOnly exigiría
 * reactivar CSRF en el backend y se descarta por ahora.
 */
@Service()
export class SesionStore {
  private readonly _sesion = signal<Sesion | null>(this.leer());
  private readonly _permisos = computed<readonly string[]>(() => this._sesion()?.permisos ?? []);

  readonly sesion = this._sesion.asReadonly();
  readonly permisos = this._permisos;
  readonly usuario = computed(() => this._sesion()?.usuario ?? null);
  readonly autenticado = computed(() => this.esVigente(this._sesion()));

  guardar(sesion: Sesion): void {
    this._sesion.set(sesion);
    this.persistir(sesion);
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
    try {
      sessionStorage.removeItem(CLAVE);
      // Limpia sesiones heredadas de versiones que usaban localStorage.
      localStorage.removeItem(CLAVE);
    } catch {
      /* almacenamiento no disponible */
    }
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

  private persistir(sesion: Sesion): void {
    try {
      sessionStorage.setItem(CLAVE, JSON.stringify(sesion));
    } catch {
      /* almacenamiento no disponible */
    }
  }

  private leer(): Sesion | null {
    try {
      localStorage.removeItem(CLAVE);
      const crudo = sessionStorage.getItem(CLAVE);
      if (!crudo) {
        return null;
      }
      const sesion = JSON.parse(crudo) as Sesion;
      if (this.esVigente(sesion)) {
        return sesion;
      }
      sessionStorage.removeItem(CLAVE);
      return null;
    } catch {
      return null;
    }
  }
}
