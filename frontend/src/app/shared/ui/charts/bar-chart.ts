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
    :host { display: block; }

    .bars {
      display: flex;
      align-items: stretch;
      gap: var(--space-2);
      padding-top: var(--space-2);
    }

    .bars__col {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
    }

    .bars__value {
      font-size: var(--fs-sm);
      font-weight: var(--fw-semibold);
      color: var(--text);
      font-variant-numeric: tabular-nums;
    }

    .bars__track {
      flex: 1;
      width: 100%;
      max-width: 40px;
      display: flex;
      align-items: flex-end;
      border-bottom: 1px solid var(--border-strong);
    }

    .bars__fill {
      width: 100%;
      border-radius: var(--radius-xs) var(--radius-xs) 0 0;
      transform-origin: bottom;
      animation: bar-grow 700ms var(--ease-out) both;
    }

    .bars__col:hover .bars__fill { filter: brightness(1.12); }

    .bars__label {
      font-size: var(--fs-xs);
      font-weight: var(--fw-medium);
      color: var(--text-3);
      text-align: center;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    @keyframes bar-grow {
      from { transform: scaleY(0); }
      to { transform: scaleY(1); }
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
