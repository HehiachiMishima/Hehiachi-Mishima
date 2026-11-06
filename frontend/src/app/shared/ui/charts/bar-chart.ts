import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarraDato {
  etiqueta: string;
  valor: number;
  color: string;
  /** Texto adicional para lectores de pantalla y tooltip (p. ej. "8 siguen activas"). */
  detalle?: string;
}

@Component({
  selector: 'ui-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bars" role="list" [attr.aria-label]="titulo()" [style.height.px]="altura()">
      @for (barra of barras(); track barra.etiqueta; let i = $index) {
        <div class="bars__col" role="listitem" [attr.title]="barra.detalle ?? null">
          <span class="u-sr-only">{{ barra.etiqueta }}: {{ barra.valor }}{{ barra.detalle ? ', ' + barra.detalle : '' }}</span>
          <span class="bars__value" aria-hidden="true">{{ barra.valor }}</span>
          <div class="bars__track" aria-hidden="true">
            <div
              class="bars__fill"
              [style.height.%]="barra.pct"
              [style.background]="barra.color"
              [style.animation-delay]="i * 90 + 'ms'"
            ></div>
          </div>
          <span class="bars__label" aria-hidden="true">{{ barra.etiqueta }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    @use 'design' as d;

    :host {
      display: block;
    }

    // Marco plano: rejilla de 1 px, ejes en mono, barras sin radio.
    .bars {
      display: flex;
      align-items: stretch;
      gap: d.space('2');
      padding-top: d.space('2');
      @include d.type('mono-00');
      color: d.color('text-muted');
    }

    .bars__col {
      display: flex;
      flex: 1;
      flex-direction: column;
      align-items: center;
      gap: d.space('2');
      min-width: 0;
    }

    .bars__value {
      @include d.tabular-nums;
      color: d.color('text-strong');
    }

    .bars__track {
      display: flex;
      flex: 1;
      align-items: flex-end;
      width: 100%;
      max-width: 2.5rem;
      border-bottom: 1px solid d.color('chart-grid');
    }

    .bars__fill {
      width: 100%;
      transform-origin: bottom;
      transition: filter d.motion('fast') d.motion('easing');

      @include d.motion-safe {
        animation: bar-grow 600ms d.motion('easing') both;
      }
    }

    .bars__col:hover .bars__fill {
      filter: brightness(0.85);
    }

    .bars__label {
      max-width: 100%;
      text-align: center;
      @include d.truncate;
    }

    @keyframes bar-grow {
      from {
        transform: scaleY(0);
      }
    }
  `,
})
export class BarChart {
  readonly datos = input<BarraDato[]>([]);
  readonly altura = input<number>(220);
  readonly titulo = input<string>('Gráfico de barras');

  readonly barras = computed(() => {
    const datos = this.datos();
    const maximo = Math.max(1, ...datos.map((dato) => dato.valor));
    return datos.map((dato) => ({
      ...dato,
      pct: dato.valor <= 0 ? 0 : Math.max(6, (dato.valor / maximo) * 100),
    }));
  });
}
