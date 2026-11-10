import { DestroyRef, Service, effect, inject, signal } from '@angular/core';
import { CONFIG } from '../config/configuracion';
import { Sesion } from '../models';
import { Anunciador } from './anunciador';
import { Auth } from './auth';
import { SesionStore } from './sesion';

const EVENTOS_ACTIVIDAD = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/**
 * Vigila el ciclo de vida de la sesión:
 * - poco antes de que venza el access token, si hubo actividad reciente lo
 *   renueva en silencio con el refresh token (no pide contraseña);
 * - si no hubo actividad, avisa con antelación y permite seguir conectado con
 *   un clic (WCAG 2.2.1); sin respuesta, cierra la sesión al vencer;
 * - al recuperar el foco (p. ej. tras suspender el equipo) revisa el token y
 *   relee los permisos vigentes.
 */
@Service()
export class SesionVigilante {
  private readonly sesionStore = inject(SesionStore);
  private readonly auth = inject(Auth);
  private readonly anunciador = inject(Anunciador);
  private temporizadorDecision?: ReturnType<typeof setTimeout>;
  private temporizadorVence?: ReturnType<typeof setTimeout>;
  private ultimaActividad = Date.now();
  private renovando = false;

  /** Hora de vencimiento cuando el aviso está visible; null si no hay aviso. */
  readonly aviso = signal<Date | null>(null);

  constructor() {
    effect(() => this.programar(this.sesionStore.sesion()));

    const alActuar = (): void => {
      this.ultimaActividad = Date.now();
    };
    const alVolver = (): void => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      this.revisar();
      this.auth.refrescarSesion().subscribe({ error: () => undefined });
    };
    for (const evento of EVENTOS_ACTIVIDAD) {
      document.addEventListener(evento, alActuar, { passive: true, capture: true });
    }
    window.addEventListener('focus', alVolver);
    document.addEventListener('visibilitychange', alVolver);
    inject(DestroyRef).onDestroy(() => {
      for (const evento of EVENTOS_ACTIVIDAD) {
        document.removeEventListener(evento, alActuar, { capture: true });
      }
      window.removeEventListener('focus', alVolver);
      document.removeEventListener('visibilitychange', alVolver);
      this.cancelar();
    });
  }

  /** "Seguir conectado" en el aviso (o cerrarlo): renueva la sesión. */
  seguirConectado(): void {
    this.aviso.set(null);
    this.ultimaActividad = Date.now();
    this.renovar();
  }

  private programar(sesion: Sesion | null): void {
    this.cancelar();
    this.aviso.set(null);
    if (!sesion?.expiraEn) {
      return;
    }
    const vence = new Date(sesion.expiraEn).getTime();
    const ahora = Date.now();
    this.temporizadorDecision = setTimeout(() => this.decidir(), Math.max(0, vence - ahora - CONFIG.sesion.avisoExpiracionMs));
    this.temporizadorVence = setTimeout(() => this.alVencer(), Math.max(0, vence - ahora));
  }

  /** Tras volver a la pestaña los temporizadores pueden haberse retrasado: se re-evalúa. */
  private revisar(): void {
    const sesion = this.sesionStore.sesion();
    if (!sesion?.expiraEn || this.renovando || this.aviso()) {
      return;
    }
    const restante = new Date(sesion.expiraEn).getTime() - Date.now();
    if (restante <= CONFIG.sesion.avisoExpiracionMs) {
      this.decidir();
    }
  }

  private decidir(): void {
    if (this.renovando) {
      return;
    }
    if (Date.now() - this.ultimaActividad < CONFIG.sesion.inactividadMaxMs) {
      this.renovar();
      return;
    }
    const vence = this.sesionStore.sesion()?.expiraEn;
    if (!vence || new Date(vence).getTime() <= Date.now()) {
      this.auth.expulsar('expirada');
      return;
    }
    this.aviso.set(new Date(vence));
    this.anunciador.anunciar('Tu sesión se cerrará pronto por inactividad. Pulsa Seguir conectado para continuar.', 'assertive');
  }

  private alVencer(): void {
    // Si hay una renovación en vuelo, su resultado decide (no se expulsa por una red lenta).
    if (this.renovando) {
      return;
    }
    this.aviso.set(null);
    this.auth.expulsar('expirada');
  }

  private renovar(): void {
    this.renovando = true;
    this.auth.renovar().subscribe((ok) => {
      this.renovando = false;
      // Con éxito la sesión cambia y el effect reprograma los temporizadores.
      if (!ok) {
        this.aviso.set(null);
        this.auth.expulsar('expirada');
      }
    });
  }

  private cancelar(): void {
    clearTimeout(this.temporizadorDecision);
    clearTimeout(this.temporizadorVence);
    this.temporizadorDecision = undefined;
    this.temporizadorVence = undefined;
  }
}
