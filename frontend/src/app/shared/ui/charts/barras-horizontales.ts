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
    @use 'design' as d;

    :host {
      display: block;
    }

    .hbars {
      display: grid;
      gap: d.space('3');
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .hbars__item {
      display: grid;
      grid-template-columns: minmax(0, 12rem) minmax(0, 1fr) 4ch;
      align-items: center;
      gap: d.space('3');
      @include d.type('body-01');
    }

    .hbars__label {
      min-width: 0;
      color: d.color('text');
      overflow-wrap: anywhere;
    }

    .hbars__sub {
      display: block;
      @include d.type('mono-00');
      color: d.color('text-faint');
    }

    // Pista y relleno planos de 8 px, sin radio.
    .hbars__track {
      height: 0.5rem;
      background: d.color('progress-track');
    }

    .hbars__fill {
      display: block;
      height: 100%;
      background: d.color('chart-2');
      transform-origin: left;

      @include d.motion-safe {
        animation: hbars-grow 600ms d.motion('easing') both;
      }
    }

    .hbars__item:hover .hbars__fill {
      background: d.color('accent');
    }

    .hbars__item--off .hbars__fill {
      background: d.color('border-strong');
    }

    .hbars__item--off .hbars__label,
    .hbars__item--off .hbars__value {
      color: d.color('text-faint');
    }

    .hbars__value {
      text-align: end;
      @include d.type('mono-01');
      @include d.tabular-nums;
      color: d.color('text-strong');
    }

    @keyframes hbars-grow {
      from {
        transform: scaleX(0);
      }
    }

    @include d.bp-down('sm') {
      .hbars__item {
        grid-template-columns: minmax(0, 1fr) auto;
        row-gap: d.space('1');
      }

      .hbars__track {
        grid-column: 1 / -1;
        grid-row: 2;
      }
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
