import { HttpErrorResponse } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { CONFIG } from '../config/configuracion';
import { mensajeDeError } from '../errors/error.util';
import { Anunciador } from './anunciador';

export type TipoNotificacion = 'exito' | 'error' | 'info' | 'advertencia';

export interface AccionNotificacion {
  etiqueta: string;
  ejecutar: () => void;
}

export interface Notificacion {
  id: number;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje?: string;
  accion?: AccionNotificacion;
}

interface Temporizador {
  id?: ReturnType<typeof setTimeout>;
  restante: number;
  inicio: number;
}

export interface OpcionesNotificacion {
  accion?: AccionNotificacion;
  duracion?: number;
}

/**
 * Avisos efímeros (toasts). Los errores persisten hasta cerrarlos; el resto se
 * cierra solo y se pausa mientras el puntero o el foco están sobre los avisos
 * (WCAG 2.2.1). Cada aviso se anuncia por las live regions del Anunciador.
 */
@Service()
export class Notificaciones {
  private readonly anunciador = inject(Anunciador);
  private readonly _items = signal<Notificacion[]>([]);
  private readonly temporizadores = new Map<number, Temporizador>();
  private contador = 0;
  private pausado = false;

  readonly items = this._items.asReadonly();

  exito(titulo: string, mensaje?: string, opciones?: OpcionesNotificacion): void {
    this.mostrar('exito', titulo, mensaje, opciones);
  }

  error(titulo: string, mensaje?: string): void {
    this.mostrar('error', titulo, mensaje);
  }

  info(titulo: string, mensaje?: string, opciones?: OpcionesNotificacion): void {
    this.mostrar('info', titulo, mensaje, opciones);
  }

  advertencia(titulo: string, mensaje?: string): void {
    this.mostrar('advertencia', titulo, mensaje);
  }

  /**
   * Error de una petición HTTP. El interceptor ya avisa de 401, sin conexión y
   * 5xx; aquí solo se notifican los 4xx para que cada error genere un único aviso.
   */
  errorHttp(titulo: string, err: unknown): void {
    if (err instanceof HttpErrorResponse && (err.status === 0 || err.status === 401 || err.status >= 500)) {
      return;
    }
    this.error(titulo, mensajeDeError(err));
  }

  cerrar(id: number): void {
    const temporizador = this.temporizadores.get(id);
    if (temporizador?.id !== undefined) {
      clearTimeout(temporizador.id);
    }
    this.temporizadores.delete(id);
    this._items.update((items) => items.filter((item) => item.id !== id));
  }

  pausar(): void {
    this.pausado = true;
    for (const temporizador of this.temporizadores.values()) {
      if (temporizador.id !== undefined) {
        clearTimeout(temporizador.id);
        temporizador.restante -= Date.now() - temporizador.inicio;
        temporizador.id = undefined;
      }
    }
  }

  reanudar(): void {
    this.pausado = false;
    for (const [id, temporizador] of this.temporizadores) {
      if (temporizador.id === undefined) {
        this.programar(id, Math.max(temporizador.restante, 1500));
      }
    }
  }

  private mostrar(tipo: TipoNotificacion, titulo: string, mensaje?: string, opciones?: OpcionesNotificacion): void {
    // Un mismo aviso ya visible (p. ej. varias peticiones sin conexión) no se repite.
    if (this._items().some((item) => item.tipo === tipo && item.titulo === titulo && item.mensaje === mensaje)) {
      return;
    }
    const id = ++this.contador;
    this._items.update((items) => [...items, { id, tipo, titulo, mensaje, accion: opciones?.accion }]);
    this.anunciador.anunciar(
      mensaje ? `${titulo}. ${mensaje}` : titulo,
      tipo === 'error' || tipo === 'advertencia' ? 'assertive' : 'polite',
    );
    if (tipo === 'error') {
      return;
    }
    const duracion = opciones?.duracion ?? CONFIG.notificaciones.duracion;
    if (this.pausado) {
      this.temporizadores.set(id, { restante: duracion, inicio: Date.now() });
    } else {
      this.programar(id, duracion);
    }
  }

  private programar(id: number, restante: number): void {
    this.temporizadores.set(id, {
      restante,
      inicio: Date.now(),
      id: setTimeout(() => this.cerrar(id), restante),
    });
  }
}
