import { Service, signal } from '@angular/core';

/**
 * Anuncia mensajes a lectores de pantalla mediante dos live regions
 * persistentes (declaradas en app.html antes de que cambie su contenido).
 */
@Service()
export class Anunciador {
  readonly cortes = signal('');
  readonly urgente = signal('');

  anunciar(mensaje: string, prioridad: 'polite' | 'assertive' = 'polite'): void {
    const destino = prioridad === 'assertive' ? this.urgente : this.cortes;
    destino.set('');
    // Vaciar y reescribir en el siguiente ciclo fuerza la relectura de textos repetidos.
    setTimeout(() => destino.set(mensaje), 50);
  }
}
