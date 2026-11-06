import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarraHorizontal {
  etiqueta: string;
  valor: number;
  /** Texto secundario (p. ej. el código del permiso). */
  secundario?: string;
  /** Resalta en gris las barras sin valor (candidatas a limpieza). */
  apagada?: boolean;
}

/**
 * Ranking en barras horizontales. Es una lista semántica: cada elemento se
 * lee como "Etiqueta: valor", sin depender del gráfico.
 */
@Component({
  selector: 'ui-barras-h',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="hbars" [attr.aria-label]="titulo()">
      @for (barra of barras(); track barra.etiqueta) {
        <li class="hbars__item" [class.hbars__item--off]="barra.apagada">
          <span class="hbars__label">
            {{ barra.etiqueta }}
            @if (barra.secundario) {
              <span class="hbars__sub">{{ barra.secundario }}</span>
            }
          </span>
          <span class="hbars__track" aria-hidden="true">
            <span class="hbars__fill" [style.width.%]="barra.pct"></span>
          </span>
          <span class="hbars__value"><span class="u-sr-only">: </span>{{ barra.valor }}</span>
        </li>
      }
    </ol>
  `,
  styles: `
    :host { display: block; }
    .hbars { display: flex; flex-direction: column; gap: var(--space-3); }
    .hbars__item {
      display: grid;
      grid-template-columns: minmax(0, 12rem) minmax(0, 1fr) 4ch;
      align-items: center;
      gap: var(--space-3);
      font-size: var(--fs-sm);
    }
    .hbars__label { min-width: 0; color: var(--text); font-weight: var(--fw-medium); overflow-wrap: anywhere; line-height: var(--lh-snug); }
    .hbars__sub { display: block; font-family: var(--font-mono); font-weight: var(--fw-regular); font-size: var(--fs-2xs); color: var(--text-3); }
    .hbars__track { height: 10px; border-radius: var(--radius-pill); background: var(--chart-track); overflow: hidden; box-shadow: inset 0 1px 2px rgba(15, 21, 48, 0.08); }
    .hbars__fill {
      display: block;
      height: 100%;
      border-radius: var(--radius-pill);
      background: var(--chart-grad-h);
      box-shadow: 0 0 12px -2px rgba(124, 58, 237, 0.55);
      transform-origin: left;
      animation: hbars-grow 600ms var(--ease-out) both;
    }
    .hbars__item--off .hbars__fill { background: var(--chart-muted); box-shadow: none; }
    .hbars__item--off .hbars__label { color: var(--text-3); }
    .hbars__value { text-align: right; font-weight: var(--fw-semibold); font-variant-numeric: tabular-nums; color: var(--text); }
    .hbars__item--off .hbars__value { color: var(--text-3); }
    @keyframes hbars-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    @media (max-width: 640px) {
      .hbars__item { grid-template-columns: minmax(0, 1fr) auto; row-gap: var(--space-1); }
      .hbars__track { grid-column: 1 / -1; grid-row: 2; }
    }
  `,
})
export class BarrasHorizontales {
  readonly datos = input<BarraHorizontal[]>([]);
  readonly titulo = input<string>('Ranking');

  readonly barras = computed(() => {
    const datos = this.datos();
    const maximo = Math.max(1, ...datos.map((dato) => dato.valor));
    return datos.map((dato) => ({ ...dato, pct: dato.valor <= 0 ? 0 : Math.max(2, (dato.valor / maximo) * 100) }));
  });
}
