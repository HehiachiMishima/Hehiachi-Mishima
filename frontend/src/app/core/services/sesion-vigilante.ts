import { DestroyRef, Service, effect, inject, signal } from '@angular/core';
import { CONFIG } from '../config/configuracion';
import { Sesion } from '../models';
import { Anunciador } from './anunciador';
import { Auth } from './auth';
import { SesionStore } from './sesion';

/**
 * Vigila el ciclo de vida de la sesión:
 * - avisa con antelación de que el token va a vencer (WCAG 2.2.1);
 * - al vencer cierra la sesión y lleva al login, aunque no haya peticiones;
 * - al recuperar el foco de la ventana relee los permisos vigentes.
 */
@Service()
export class SesionVigilante {
  private readonly sesionStore = inject(SesionStore);
  private readonly auth = inject(Auth);
  private readonly anunciador = inject(Anunciador);
  private temporizador?: ReturnType<typeof setTimeout>;
  private temporizadorAviso?: ReturnType<typeof setTimeout>;

  /** Hora de vencimiento cuando el aviso está visible; null si no hay aviso. */
  readonly aviso = signal<Date | null>(null);

  constructor() {
    effect(() => this.programar(this.sesionStore.sesion()));

    const alEnfocar = (): void => {
      if (document.visibilityState === 'visible') {
        this.auth.refrescarSesion().subscribe({ error: () => undefined });
      }
    };
    window.addEventListener('focus', alEnfocar);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('focus', alEnfocar);
      this.cancelar();
    });
  }

  descartarAviso(): void {
    this.aviso.set(null);
  }

  private programar(sesion: Sesion | null): void {
    this.cancelar();
    this.aviso.set(null);
    if (!sesion?.expiraEn) {
      return;
    }

    const vence = new Date(sesion.expiraEn);
    const restante = vence.getTime() - Date.now() - CONFIG.sesion.margenExpiracionMs;
    if (restante <= 0) {
      this.auth.expulsar('expirada');
      return;
    }
    this.temporizador = setTimeout(() => {
      this.aviso.set(null);
      this.auth.expulsar('expirada');
    }, restante);

    const hastaAviso = restante - CONFIG.sesion.avisoExpiracionMs;
    this.temporizadorAviso = setTimeout(() => this.avisar(vence), Math.max(0, hastaAviso));
  }

  private avisar(vence: Date): void {
    this.aviso.set(vence);
    this.anunciador.anunciar('Tu sesión vencerá en unos minutos. Guarda tus cambios.', 'assertive');
  }

  private cancelar(): void {
    clearTimeout(this.temporizador);
    clearTimeout(this.temporizadorAviso);
    this.temporizador = undefined;
    this.temporizadorAviso = undefined;
  }
}
