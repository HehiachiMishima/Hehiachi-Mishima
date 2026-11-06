import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';

/**
 * Convierte una tabla en columnas de ancho fijo (el contenido se trunca con …)
 * y añade un asa en cada cabecera para redimensionar arrastrando, con el
 * teclado (flechas) o con doble clic (ajustar al contenido).
 * Al arrastrar una columna se ajusta la vecina para mantener el ancho total.
 *
 * Los anchos se calculan después de pintarse las filas (los botones condicionados
 * con *hasPermiso se renderizan en un efecto, posterior a ngAfterViewInit).
 *
 * Solo en escritorio amplio (≥1280 px): por debajo la tabla oculta columnas de
 * baja prioridad y en móvil cada fila es una tarjeta, así que medir allí fijaría
 * anchos erróneos. Si la ventana crece hasta ese ancho, se mide entonces.
 */
const ANCHO_MINIMO = 72;
const ESCRITORIO = '(min-width: 1280px)';

@Directive({ selector: 'table[appColumnasRedimensionables]' })
export class ColumnasRedimensionables implements AfterViewInit, OnDestroy {
  private readonly tabla = inject<ElementRef<HTMLTableElement>>(ElementRef);
  private readonly limpiezas: (() => void)[] = [];
  private temporizador: number | null = null;
  private marco: number | null = null;
  private marcoAcciones: number | null = null;

  ngAfterViewInit(): void {
    const consulta = window.matchMedia(ESCRITORIO);
    if (consulta.matches) {
      this.programar();
      return;
    }
    const alCambiar = (evento: MediaQueryListEvent): void => {
      if (evento.matches) {
        consulta.removeEventListener('change', alCambiar);
        this.programar();
      }
    };
    consulta.addEventListener('change', alCambiar);
    this.limpiezas.push(() => consulta.removeEventListener('change', alCambiar));
  }

  private programar(): void {
    this.temporizador = window.setTimeout(() => {
      this.temporizador = null;
      this.marco = requestAnimationFrame(() => {
        this.marco = null;
        this.fijarAnchos();
      });
    }, 0);
  }

  private fijarAnchos(): void {
    const tabla = this.tabla.nativeElement;
    const fila = tabla.tHead?.rows[0];
    if (!fila) {
      return;
    }

    const celdas = Array.from(fila.cells) as HTMLTableCellElement[];
    if (celdas.length < 2) {
      return;
    }

    // Medir con el layout automático (ancho natural según el contenido).
    const anchos = celdas.map((celda) => Math.round(celda.getBoundingClientRect().width));
    const total = anchos.reduce((acumulado, ancho) => acumulado + ancho, 0);
    if (total <= 0) {
      return;
    }

    tabla.classList.add('ui-table--rigid');
    tabla.style.minWidth = `${total}px`;

    const colgroup = document.createElement('colgroup');
    anchos.forEach((ancho) => {
      const col = document.createElement('col');
      col.style.width = `${ancho}px`;
      colgroup.appendChild(col);
    });
    tabla.insertBefore(colgroup, tabla.firstChild);
    const cols = Array.from(colgroup.children) as HTMLTableColElement[];

    const aplicar = (indice: number): void => {
      cols[indice].style.width = `${anchos[indice]}px`;
    };

    celdas.forEach((celda, indice) => {
      const vecino = indice === celdas.length - 1 ? indice - 1 : indice + 1;
      if (vecino < 0) {
        return;
      }

      const asa = document.createElement('span');
      asa.className = 'col-resize';
      asa.tabIndex = 0;
      asa.setAttribute('role', 'separator');
      asa.setAttribute('aria-orientation', 'vertical');
      asa.setAttribute('aria-label', `Ancho de la columna ${celda.textContent?.trim() ?? ''}`);
      asa.title = 'Arrastra o usa las flechas para cambiar el ancho; doble clic para ajustarlo al contenido';
      celda.appendChild(asa);

      const actualizarAria = (): void => {
        asa.setAttribute('aria-valuemin', String(ANCHO_MINIMO));
        asa.setAttribute('aria-valuemax', String(anchos[indice] + anchos[vecino] - ANCHO_MINIMO));
        asa.setAttribute('aria-valuenow', String(anchos[indice]));
      };
      actualizarAria();

      const fijar = (nuevo: number): void => {
        const par = anchos[indice] + anchos[vecino];
        const valor = Math.min(Math.max(nuevo, ANCHO_MINIMO), par - ANCHO_MINIMO);
        anchos[indice] = valor;
        anchos[vecino] = par - valor;
        aplicar(indice);
        aplicar(vecino);
        actualizarAria();
      };

      const alBajar = (evento: PointerEvent): void => {
        evento.preventDefault();
        evento.stopPropagation();

        const xInicial = evento.clientX;
        const inicio = anchos[indice];
        document.body.classList.add('col-resize--activo');

        const alMover = (mov: PointerEvent): void => fijar(inicio + (mov.clientX - xInicial));

        const alSoltar = (): void => {
          window.removeEventListener('pointermove', alMover);
          window.removeEventListener('pointerup', alSoltar);
          document.body.classList.remove('col-resize--activo');
        };

        window.addEventListener('pointermove', alMover);
        window.addEventListener('pointerup', alSoltar);
      };

      // Teclado (WCAG 2.1.1): flechas ±16 px (Mayús ±48), Inicio/Fin a los extremos.
      const alTeclear = (evento: KeyboardEvent): void => {
        const paso = evento.shiftKey ? 48 : 16;
        const acciones: Record<string, () => void> = {
          ArrowLeft: () => fijar(anchos[indice] - paso),
          ArrowRight: () => fijar(anchos[indice] + paso),
          Home: () => fijar(ANCHO_MINIMO),
          End: () => fijar(Number.MAX_SAFE_INTEGER),
        };
        const accion = acciones[evento.key];
        if (accion) {
          evento.preventDefault();
          accion();
        }
      };

      // Alternativa sin arrastre (WCAG 2.5.7): doble clic ajusta la columna a su contenido.
      const alDobleClic = (): void => {
        const necesario = Math.max(
          ...Array.from(tabla.rows).map((fila) => (fila.cells[indice] as HTMLElement | undefined)?.scrollWidth ?? 0),
        );
        fijar(necesario + 2);
      };

      asa.addEventListener('pointerdown', alBajar);
      asa.addEventListener('keydown', alTeclear);
      asa.addEventListener('dblclick', alDobleClic);
      this.limpiezas.push(() => {
        asa.removeEventListener('pointerdown', alBajar);
        asa.removeEventListener('keydown', alTeclear);
        asa.removeEventListener('dblclick', alDobleClic);
      });
    });

    // Red de seguridad: si la última columna (acciones) quedó recortada,
    // ampliarla para que los botones siempre se vean.
    this.marcoAcciones = requestAnimationFrame(() => {
      this.marcoAcciones = null;
      const celda = tabla.tBodies[0]?.rows[0]?.cells[anchos.length - 1] as HTMLElement | undefined;
      if (!celda) {
        return;
      }
      const deficit = celda.scrollWidth - celda.clientWidth;
      if (deficit > 1) {
        const indice = anchos.length - 1;
        anchos[indice] += deficit;
        cols[indice].style.width = `${anchos[indice]}px`;
        tabla.style.minWidth = `${anchos.reduce((acumulado, ancho) => acumulado + ancho, 0)}px`;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.temporizador !== null) {
      window.clearTimeout(this.temporizador);
    }
    if (this.marco !== null) {
      cancelAnimationFrame(this.marco);
    }
    if (this.marcoAcciones !== null) {
      cancelAnimationFrame(this.marcoAcciones);
    }
    this.limpiezas.forEach((limpiar) => limpiar());
    this.limpiezas.length = 0;
    document.body.classList.remove('col-resize--activo');
  }
}
