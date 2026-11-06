import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { TemaService } from '../../core/services/tema';
import { PANEL_ACTUAL } from '../../paneles/panel-actual';
import { modulosAccesibles, panelesAccesibles, urlModulo, urlPanel } from '../../paneles/registro';
import { Icon } from '../../shared/ui/icon/icon';

interface Opcion {
  id: string;
  grupo: string;
  nombre: string;
  descripcion: string;
  icono: string;
  ejecutar: () => void;
}

/** Normaliza para buscar sin tildes ni mayúsculas. */
const normalizar = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Paleta de módulos (Ctrl/⌘ K). Se deriva del registro de paneles: muestra
 * los módulos accesibles del panel actual, agrupados como en la barra lateral,
 * los demás paneles accesibles y la acción de tema. Usa <dialog> nativo
 * (capa superior, fondo inerte, Escape) y el patrón combobox + listbox con
 * aria-activedescendant.
 */
@Component({
  selector: 'app-paleta-modulos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <dialog #dialogo class="paleta" aria-label="Ir a un módulo" (close)="alCerrar()" (click)="alClicFondo($event)">
      <div class="paleta__caja">
        <div class="paleta__buscar">
          <ui-icon name="search" [size]="18" />
          <input
            #entrada
            type="text"
            class="paleta__input"
            role="combobox"
            aria-expanded="true"
            aria-controls="paleta-lista"
            aria-autocomplete="list"
            aria-label="Buscar módulo o acción"
            placeholder="Buscar módulo o acción…"
            autocomplete="off"
            spellcheck="false"
            [value]="consulta()"
            [attr.aria-activedescendant]="activa() ? 'paleta-op-' + activa()!.id : null"
            (input)="filtrar($any($event.target).value)"
            (keydown)="alTeclear($event)"
          />
          <kbd class="paleta__kbd" aria-hidden="true">Esc</kbd>
        </div>
        <ul id="paleta-lista" class="paleta__lista" role="listbox" aria-label="Resultados">
          @for (opcion of opciones(); track opcion.id; let i = $index) {
            @if (i === 0 || opciones()[i - 1].grupo !== opcion.grupo) {
              <li class="paleta__grupo" role="presentation">{{ opcion.grupo }}</li>
            }
            <li
              class="paleta__opcion"
              role="option"
              [id]="'paleta-op-' + opcion.id"
              [attr.aria-selected]="i === indice()"
              (mousemove)="indice.set(i)"
              (click)="ejecutar(opcion)"
            >
              <span class="paleta__icono" aria-hidden="true"><ui-icon [name]="opcion.icono" [size]="16" /></span>
              <span class="paleta__texto">
                <span class="paleta__nombre">{{ opcion.nombre }}</span>
                <span class="paleta__desc">{{ opcion.descripcion }}</span>
              </span>
              <ui-icon class="paleta__ir" name="chevronRight" [size]="16" />
            </li>
          } @empty {
            <li class="paleta__vacio" role="presentation">Sin coincidencias para «{{ consulta() }}».</li>
          }
        </ul>
        <p class="paleta__pie" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> moverse</span>
          <span><kbd>↵</kbd> abrir</span>
        </p>
      </div>
    </dialog>
  `,
  styles: `
    @use 'design' as d;

    // Flota sobre la página: panel plano con borde y la sombra grande de los modales.
    .paleta {
      width: min(35rem, calc(100vw - #{d.space('8')}));
      max-width: none;
      max-height: min(32.5rem, calc(100dvh - #{d.space('16')}));
      margin: max(12dvh, #{d.space('12')}) auto auto;
      padding: 0;
      border: 1px solid d.color('border');
      border-radius: d.radius('lg');
      background: d.color('surface');
      color: d.color('text');
      box-shadow: d.shadow('lg');
      overflow: hidden;
    }

    .paleta[open] {
      display: flex;
    }

    .paleta::backdrop {
      background: d.color('overlay');
    }

    .paleta__caja {
      display: flex;
      flex-direction: column;
      width: 100%;
      min-height: 0;
    }

    .paleta__buscar {
      display: flex;
      align-items: center;
      gap: d.space('3');
      padding: 0 d.space('4');
      border-bottom: 1px solid d.color('border');
      color: d.color('text-faint');
    }

    .paleta__input {
      flex: 1;
      min-width: 0;
      height: d.layout('topbar-height');
      border: 0 !important;
      background: transparent;
      @include d.type('body-02');
      color: d.color('text');
      outline: none !important;
    }

    kbd {
      @include d.kbd;
    }

    .paleta__lista {
      flex: 1;
      min-height: 0;
      margin: 0;
      padding: d.space('2') 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      list-style: none;
    }

    .paleta__grupo {
      padding: d.space('3') d.space('4') d.space('1');
      @include d.eyebrow;
    }

    .paleta__opcion {
      display: flex;
      align-items: center;
      gap: d.space('3');
      min-height: d.layout('control-height');
      padding: d.space('2') d.space('4');
      cursor: pointer;
      transition: background-color d.motion('fast') d.motion('easing');
    }

    .paleta__opcion[aria-selected='true'] {
      background: d.color('primary-soft');

      .paleta__nombre,
      .paleta__icono,
      .paleta__ir {
        color: d.color('accent');
      }

      .paleta__ir {
        opacity: 1;
      }
    }

    .paleta__icono {
      display: inline-grid;
      flex-shrink: 0;
      place-items: center;
      color: d.color('text-faint');
    }

    .paleta__texto {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }

    .paleta__nombre {
      @include d.type('interface-01');
      color: d.color('text-strong');
    }

    .paleta__desc {
      @include d.type('body-00');
      color: d.color('text-muted');
      @include d.truncate;
    }

    .paleta__ir {
      flex-shrink: 0;
      opacity: 0;
    }

    .paleta__vacio {
      padding: d.space('8') d.space('4');
      @include d.type('body-01');
      color: d.color('text-muted');
    }

    .paleta__pie {
      display: flex;
      gap: d.space('4');
      padding: d.space('2') d.space('4');
      border-top: 1px solid d.color('border');
      background: d.color('surface-muted');
      @include d.type('body-00');
      color: d.color('text-muted');

      span {
        display: inline-flex;
        align-items: center;
        gap: d.space('1');
      }
    }

    @include d.bp-down('sm') {
      .paleta {
        width: 100vw;
        max-height: calc(100dvh - #{d.space('12')});
        margin: 0 0 auto;
        border-width: 0 0 1px;
      }

      .paleta__pie {
        display: none;
      }
    }

    @include d.touch {
      .paleta__kbd {
        display: none;
      }
    }
  `,
})
export class PaletaModulos {
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);
  private readonly tema = inject(TemaService);
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly entrada = viewChild.required<ElementRef<HTMLInputElement>>('entrada');

  readonly abierta = input(false);
  readonly cerrar = output<void>();

  readonly consulta = signal('');
  readonly indice = signal(0);

  private readonly panel = inject(PANEL_ACTUAL);

  private readonly todas = computed<Opcion[]>(() => {
    const permisos = this.auth.permisos();
    const visibles = modulosAccesibles(this.panel, permisos);
    const modulos = this.panel.grupos.flatMap((grupo) =>
      visibles
        .filter((m) => m.grupo === grupo.id)
        .map((m) => ({
          id: m.id,
          grupo: grupo.nombre,
          nombre: m.nombre,
          descripcion: m.descripcion,
          icono: m.icono,
          ejecutar: () => void this.router.navigateByUrl(urlModulo(this.panel, m)),
        })),
    );
    const otrosPaneles = panelesAccesibles(permisos)
      .filter((p) => p.id !== this.panel.id)
      .map((p) => ({
        id: `panel-${p.id}`,
        grupo: 'Otros paneles',
        nombre: p.nombre,
        descripcion: p.descripcion,
        icono: p.icono,
        ejecutar: () => void this.router.navigateByUrl(urlPanel(p)),
      }));
    const oscuro = this.tema.tema() === 'dark';
    return [
      ...modulos,
      ...otrosPaneles,
      {
        id: 'accion-tema',
        grupo: 'Preferencias',
        nombre: oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro',
        descripcion: 'Apariencia de la consola en este navegador.',
        icono: oscuro ? 'sun' : 'moon',
        ejecutar: () => this.tema.alternar(),
      },
    ];
  });

  readonly opciones = computed(() => {
    const q = normalizar(this.consulta().trim());
    if (!q) {
      return this.todas();
    }
    // Coincide por inicio de palabra ("tema" no encuentra "sistema").
    const terminos = q.split(/\s+/);
    return this.todas().filter((o) => {
      const palabras = normalizar(`${o.nombre} ${o.descripcion} ${o.grupo}`).split(/[^a-z0-9]+/);
      return terminos.every((t) => palabras.some((p) => p.startsWith(t)));
    });
  });

  readonly activa = computed(() => this.opciones()[this.indice()] ?? null);

  constructor() {
    effect(() => {
      const dialogo = this.dialogo().nativeElement;
      if (this.abierta() && !dialogo.open) {
        this.consulta.set('');
        this.indice.set(0);
        dialogo.showModal();
        this.entrada().nativeElement.focus();
      } else if (!this.abierta() && dialogo.open) {
        dialogo.close();
      }
    });
  }

  filtrar(valor: string): void {
    this.consulta.set(valor);
    this.indice.set(0);
  }

  alTeclear(evento: KeyboardEvent): void {
    const total = this.opciones().length;
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (total === 0) {
        return;
      }
      const paso = evento.key === 'ArrowDown' ? 1 : -1;
      this.indice.update((i) => (i + paso + total) % total);
      queueMicrotask(() =>
        document.getElementById(`paleta-op-${this.activa()?.id}`)?.scrollIntoView({ block: 'nearest' }),
      );
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      const opcion = this.activa();
      if (opcion) {
        this.ejecutar(opcion);
      }
    }
  }

  ejecutar(opcion: Opcion): void {
    this.dialogo().nativeElement.close();
    opcion.ejecutar();
  }

  alClicFondo(evento: MouseEvent): void {
    if (evento.target === evento.currentTarget) {
      this.dialogo().nativeElement.close();
    }
  }

  alCerrar(): void {
    this.cerrar.emit();
  }
}
