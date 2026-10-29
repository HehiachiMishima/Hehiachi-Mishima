import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CONFIG } from '../../../core/config/configuracion';
import { formatearNumero } from '../../util/formato';
import { Icon } from '../icon/icon';

let secuencia = 0;

/**
 * Paginador con rango visible ("Mostrando 1–10 de 57"), tamaño de página y
 * navegación. Los extremos usan aria-disabled para no perder el foco.
 */
@Component({
  selector: 'ui-paginador',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @if (total() > 0) {
      <div class="ui-paginador">
        <p class="ui-paginador__info">
          Mostrando <strong>{{ desde() }}–{{ hasta() }}</strong> de <strong>{{ totalTexto() }}</strong>
        </p>

        <label class="ui-paginador__size" [for]="idTamano">
          Filas por página
          <select [id]="idTamano" [value]="porPagina()" (change)="cambiarTamano($event)">
            @for (opcion of opciones(); track opcion) {
              <option [value]="opcion" [selected]="opcion === porPagina()">{{ opcion }}</option>
            }
          </select>
        </label>

        @if (totalPaginas() > 1) {
          <nav class="ui-paginador__nav" aria-label="Paginación">
            <button
              type="button"
              class="ui-paginador__btn"
              [attr.aria-disabled]="pagina() <= 1 || null"
              (click)="ir(pagina() - 1)"
              aria-label="Página anterior"
            >
              <ui-icon name="chevronLeft" [size]="16" />
            </button>

            @for (p of paginas(); track $index) {
              @if (p === 'gap') {
                <span class="ui-paginador__gap" aria-hidden="true">…</span>
              } @else {
                <button
                  type="button"
                  class="ui-paginador__btn"
                  [class.ui-paginador__btn--activa]="p === pagina()"
                  [attr.aria-current]="p === pagina() ? 'page' : null"
                  [attr.aria-label]="'Página ' + p"
                  (click)="ir(p)"
                >
                  {{ p }}
                </button>
              }
            }

            <button
              type="button"
              class="ui-paginador__btn"
              [attr.aria-disabled]="pagina() >= totalPaginas() || null"
              (click)="ir(pagina() + 1)"
              aria-label="Página siguiente"
            >
              <ui-icon name="chevronRight" [size]="16" />
            </button>
          </nav>
        }
      </div>
    }
  `,
})
export class Paginador {
  readonly idTamano = `ui-paginador-tamano-${++secuencia}`;

  readonly pagina = input<number>(1);
  readonly total = input<number>(0);
  readonly porPagina = input<number>(10);
  readonly opciones = input<readonly number[]>(CONFIG.paginacion.opciones);

  readonly paginaCambia = output<number>();
  readonly porPaginaCambia = output<number>();

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / this.porPagina())));
  readonly totalTexto = computed(() => formatearNumero(this.total()));

  readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * this.porPagina() + 1,
  );

  readonly hasta = computed(() => Math.min(this.total(), this.pagina() * this.porPagina()));

  readonly paginas = computed<(number | 'gap')[]>(() => {
    const total = this.totalPaginas();
    const actual = this.pagina();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const numeros = new Set<number>([1, actual - 1, actual, actual + 1, total]);
    const ordenados = [...numeros].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);

    const resultado: (number | 'gap')[] = [];
    let anterior = 0;
    for (const n of ordenados) {
      if (anterior && n - anterior > 1) {
        resultado.push('gap');
      }
      resultado.push(n);
      anterior = n;
    }
    return resultado;
  });

  ir(pagina: number): void {
    const destino = Math.min(Math.max(1, pagina), this.totalPaginas());
    if (destino !== this.pagina()) {
      this.paginaCambia.emit(destino);
    }
  }

  cambiarTamano(evento: Event): void {
    const valor = Number((evento.target as HTMLSelectElement).value);
    if (valor && valor !== this.porPagina()) {
      this.porPaginaCambia.emit(valor);
    }
  }
}
