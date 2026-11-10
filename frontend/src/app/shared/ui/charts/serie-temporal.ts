import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/** Un instante de la serie; `valores` se apilan (barras) o se usa el primero (línea). */
export interface PuntoSerie {
  etiqueta: string;
  valores: number[];
}

/** Nombre y color (variable CSS) de cada componente apilado. */
export interface ComponenteSerie {
  nombre: string;
  color: string;
}

const ANCHO_COL = 10;
const ALTO = 100;

/**
 * Serie temporal plana (SVG, sin dependencias): barras apiladas o línea.
 * Rejilla de 1 px, ejes en mono, sin radios ni sombras. Al pasar el puntero
 * (o con el foco + flechas) muestra el valor de cada columna.
 *   <ui-serie tipo="barras" [puntos]="p" [componentes]="[{nombre:'OK', color:'var(--color-chart-3)'}]" />
 */
@Component({
  selector: 'ui-serie',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="serie" [attr.aria-label]="titulo()">
      <div class="serie__lectura" aria-live="polite">
        @if (activo(); as a) {
          <span class="serie__hora">{{ a.etiqueta }}</span>
          @for (c of componentes(); track c.nombre; let i = $index) {
            @if (tipo() === 'barras' || i === 0) {
              <span class="serie__valor"><i [style.background]="c.color"></i>{{ c.nombre }} <strong>{{ a.valores[i] ?? 0 }}{{ unidad() }}</strong></span>
            }
          }
        } @else {
          <span class="serie__hora">Máx. {{ maximoTexto() }}</span>
          @for (c of componentes(); track c.nombre; let i = $index) {
            @if (tipo() === 'barras' || i === 0) {
              <span class="serie__valor"><i [style.background]="c.color"></i>{{ c.nombre }}</span>
            }
          }
        }
      </div>
      <div class="serie__lienzo" [style.height.px]="altura()">
        <span class="serie__eje serie__eje--max" aria-hidden="true">{{ maximoTexto() }}</span>
        <span class="serie__eje serie__eje--cero" aria-hidden="true">0</span>
        <svg
          [attr.viewBox]="'0 0 ' + ancho() + ' ' + alto"
          preserveAspectRatio="none"
          tabindex="0"
          role="img"
          [attr.aria-label]="resumenAccesible()"
          (mouseleave)="indice.set(-1)"
          (blur)="indice.set(-1)"
          (keydown.arrowRight)="mover(1, $event)"
          (keydown.arrowLeft)="mover(-1, $event)"
        >
          <line class="serie__rejilla" x1="0" [attr.x2]="ancho()" y1="50" y2="50" vector-effect="non-scaling-stroke" />
          <line class="serie__rejilla" x1="0" [attr.x2]="ancho()" y1="0.5" y2="0.5" vector-effect="non-scaling-stroke" />
          @if (tipo() === 'barras') {
            @for (col of columnas(); track $index) {
              @for (seg of col; track $index) {
                <rect [attr.x]="seg.x" [attr.y]="seg.y" [attr.width]="anchoBarra" [attr.height]="seg.h" [attr.fill]="seg.color" />
              }
            }
          } @else {
            <path class="serie__area" [attr.d]="area()" [attr.fill]="componentes()[0]?.color" />
            <path class="serie__linea" [attr.d]="linea()" [attr.stroke]="componentes()[0]?.color" vector-effect="non-scaling-stroke" />
          }
          @if (indice() >= 0) {
            <rect class="serie__cursor" [attr.x]="indice() * anchoCol" y="0" [attr.width]="anchoCol" [attr.height]="alto" />
          }
          @for (p of puntos(); track $index) {
            <rect class="serie__zona" [attr.x]="$index * anchoCol" y="0" [attr.width]="anchoCol" [attr.height]="alto"
              (mouseenter)="indice.set($index)" />
          }
        </svg>
      </div>
      <div class="serie__x" aria-hidden="true">
        <span>{{ puntos()[0]?.etiqueta }}</span>
        <span>{{ puntos()[mitad()]?.etiqueta }}</span>
        <span>{{ puntos()[puntos().length - 1]?.etiqueta }}</span>
      </div>
    </figure>
  `,
  styles: `
    @use 'design' as d;

    :host {
      display: block;
      min-width: 0;
    }

    .serie {
      display: grid;
      gap: d.space('2');
      margin: 0;
    }

    .serie__lectura {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: d.space('1') d.space('4');
      min-height: 1.25rem;
      @include d.type('mono-00');
      color: d.color('text-muted');

      strong {
        color: d.color('text-strong');
        font-weight: d.font-weight('medium');
        @include d.tabular-nums;
      }
    }

    .serie__hora {
      @include d.type('mono-00-caps');
      color: d.color('text-faint');
    }

    .serie__valor {
      display: inline-flex;
      align-items: center;
      gap: d.space('1');

      i {
        display: inline-block;
        width: 0.5rem;
        height: 0.5rem;
      }
    }

    .serie__lienzo {
      position: relative;
      padding-left: 2.75rem;
      border-bottom: 1px solid d.color('chart-grid');
    }

    .serie__eje {
      position: absolute;
      left: 0;
      @include d.type('mono-00');
      @include d.tabular-nums;
      color: d.color('text-faint');

      &--max {
        top: -0.375rem;
      }

      &--cero {
        bottom: -0.375rem;
      }
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
      outline: none;

      &:focus-visible {
        box-shadow: 0 0 0 2px d.color('focus');
      }
    }

    .serie__rejilla {
      stroke: d.color('chart-grid');
      stroke-width: 1;
      stroke-dasharray: 2 3;
    }

    .serie__linea {
      fill: none;
      stroke-width: 1.5;
    }

    .serie__area {
      opacity: 0.12;
    }

    .serie__cursor {
      fill: d.color('surface-hover');
      opacity: 0.6;
      pointer-events: none;
    }

    .serie__zona {
      fill: transparent;
    }

    .serie__x {
      display: flex;
      justify-content: space-between;
      padding-left: 2.75rem;
      @include d.type('mono-00');
      color: d.color('text-faint');
    }
  `,
})
export class SerieTemporal {
  readonly puntos = input<PuntoSerie[]>([]);
  readonly componentes = input<ComponenteSerie[]>([]);
  readonly tipo = input<'barras' | 'linea'>('barras');
  readonly unidad = input('');
  readonly altura = input(160);
  readonly titulo = input('Serie temporal');

  protected readonly alto = ALTO;
  protected readonly anchoCol = ANCHO_COL;
  protected readonly anchoBarra = ANCHO_COL - 2;
  protected readonly indice = signal(-1);

  protected readonly ancho = computed(() => Math.max(1, this.puntos().length) * ANCHO_COL);
  protected readonly mitad = computed(() => Math.floor((this.puntos().length - 1) / 2));
  protected readonly activo = computed(() => this.puntos()[this.indice()] ?? null);

  /** Máximo "redondo" del eje para que la rejilla media caiga en un número legible. */
  private readonly maximo = computed(() => {
    const total = (p: PuntoSerie) => (this.tipo() === 'barras' ? p.valores.reduce((s, v) => s + v, 0) : (p.valores[0] ?? 0));
    const max = Math.max(0, ...this.puntos().map(total));
    if (max <= 0) {
      return 1;
    }
    const base = 10 ** Math.floor(Math.log10(max));
    const paso = [1, 2, 2.5, 5, 10].find((f) => f * base >= max) ?? 10;
    return paso * base;
  });

  protected readonly maximoTexto = computed(() => {
    const m = this.maximo();
    return (m >= 1000 ? `${Math.round(m / 100) / 10}k` : String(m)) + this.unidad();
  });

  protected readonly columnas = computed(() => {
    const max = this.maximo();
    const colores = this.componentes().map((c) => c.color);
    return this.puntos().map((p, i) => {
      let base = ALTO;
      return p.valores.map((v, j) => {
        const h = (v / max) * ALTO;
        base -= h;
        return { x: i * ANCHO_COL + 1, y: base, h, color: colores[j] ?? 'currentColor' };
      });
    });
  });

  private readonly coordenadas = computed(() => {
    const max = this.maximo();
    return this.puntos().map((p, i) => [i * ANCHO_COL + ANCHO_COL / 2, ALTO - ((p.valores[0] ?? 0) / max) * ALTO] as const);
  });

  protected readonly linea = computed(() =>
    this.coordenadas()
      .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' '),
  );

  protected readonly area = computed(() => {
    const c = this.coordenadas();
    if (!c.length) {
      return '';
    }
    return `${this.linea()} L${c[c.length - 1][0]},${ALTO} L${c[0][0]},${ALTO} Z`;
  });

  protected readonly resumenAccesible = computed(() => {
    const p = this.puntos();
    if (!p.length) {
      return `${this.titulo()}: sin datos`;
    }
    const totales = p.map((x) => (this.tipo() === 'barras' ? x.valores.reduce((s, v) => s + v, 0) : (x.valores[0] ?? 0)));
    const max = Math.max(...totales);
    return `${this.titulo()}, de ${p[0].etiqueta} a ${p[p.length - 1].etiqueta}. Máximo ${max}${this.unidad()}. Usa las flechas para recorrer los valores.`;
  });

  protected mover(paso: number, evento: Event): void {
    evento.preventDefault();
    const n = this.puntos().length;
    if (!n) {
      return;
    }
    const actual = this.indice() < 0 ? (paso > 0 ? -1 : n) : this.indice();
    this.indice.set(Math.min(n - 1, Math.max(0, actual + paso)));
  }
}
