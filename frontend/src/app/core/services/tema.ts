import { Service, signal } from '@angular/core';
import { CONFIG } from '../config/configuracion';

export type Tema = 'light' | 'dark';

const CLAVE = CONFIG.almacenamiento.tema;

@Service()
export class TemaService {
  private readonly _tema = signal<Tema>(this.inicial());

  readonly tema = this._tema.asReadonly();

  constructor() {
    this.aplicar(this._tema());
  }

  alternar(): void {
    this.establecer(this._tema() === 'light' ? 'dark' : 'light');
  }

  establecer(tema: Tema): void {
    this._tema.set(tema);
    this.aplicar(tema);
    try {
      localStorage.setItem(CLAVE, tema);
    } catch {
      /* almacenamiento no disponible */
    }
  }

  private aplicar(tema: Tema): void {
    document.documentElement.dataset['theme'] = tema;
  }

  private inicial(): Tema {
    try {
      const guardado = localStorage.getItem(CLAVE);
      if (guardado === 'dark' || guardado === 'light') {
        return guardado;
      }
    } catch {
      /* almacenamiento no disponible */
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
