import { Service, computed, inject, signal } from '@angular/core';
import { Anunciador } from './anunciador';

@Service()
export class Carga {
  private readonly anunciador = inject(Anunciador);
  private readonly estado = signal<{ visible: boolean; texto: string }>({
    visible: false,
    texto: '',
  });

  readonly visible = computed(() => this.estado().visible);
  readonly texto = computed(() => this.estado().texto);

  mostrar(texto = 'Cargando…'): void {
    this.estado.set({ visible: true, texto });
    this.anunciador.anunciar(texto);
  }

  ocultar(): void {
    this.estado.set({ visible: false, texto: '' });
  }
}
