import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, skip } from 'rxjs';
import { Auth } from '../core/services/auth';
import { TemaService } from '../core/services/tema';
import { MenuCuenta } from '../features/cuenta/menu-cuenta';
import { PANEL_ACTUAL, proveerPanelActual } from '../paneles/panel-actual';
import { moduloDeUrl, modulosAccesibles, panelesAccesibles, primerModuloAccesible, urlModulo, urlPanel } from '../paneles/registro';
import { Icon } from '../shared/ui/icon/icon';
import { PaletaModulos } from './paleta-modulos/paleta-modulos';

/** Preferencia de presentación: barra lateral compacta en escritorio (por navegador). */
const CLAVE_COMPACTA = 'hm.barraCompacta';

const esMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

@Component({
  selector: 'app-panel-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, MenuCuenta, PaletaModulos],
  providers: [proveerPanelActual()],
  host: {
    '[attr.data-tono]': 'panel.tono',
    '(document:keydown.escape)': 'cerrarConEscape()',
    '(document:keydown)': 'atajo($event)',
  },
  templateUrl: './panel-shell.html',
  styleUrl: './panel-shell.scss',
})
export class PanelShell {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  readonly tema = inject(TemaService);

  private readonly botonMenu = viewChild<ElementRef<HTMLButtonElement>>('botonMenu');
  private readonly navegacion = viewChild<ElementRef<HTMLElement>>('navegacion');

  /** Panel de esta ruta (`data.panel`); lo heredan sus módulos vía PANEL_ACTUAL. */
  readonly panel = inject(PANEL_ACTUAL);
  readonly urlModulo = urlModulo;
  readonly urlPanel = urlPanel;

  /** Paneles a los que se puede saltar desde el conmutador de la barra lateral. */
  readonly paneles = computed(() => panelesAccesibles(this.auth.permisos()));
  readonly conmutadorAbierto = signal(false);
  /**
   * En móvil/tableta (<1024 px) la barra lateral es un panel superpuesto que
   * se comporta como un diálogo: arranca cerrada, deja el contenido inerte
   * mientras está abierta, Escape la cierra y el foco vuelve al botón.
   */
  readonly menuAbierto = signal(false);

  /**
   * En escritorio (≥1024 px) la barra lateral es fija y siempre visible: sin
   * velo, sin inert y sin botón de menú. Solo es estado de presentación.
   */
  private readonly consultaEscritorio = window.matchMedia('(min-width: 1024px)');
  readonly escritorio = signal(this.consultaEscritorio.matches);

  /**
   * Barra lateral compacta (solo iconos con tooltip) en escritorio. Se recuerda
   * por navegador. En móvil/tableta no aplica: allí es un cajón completo.
   */
  readonly compacta = signal(this.leerCompacta());
  /** Tooltip de la barra compacta: se pinta fuera del scroll de la navegación. */
  readonly tip = signal<{ texto: string; y: number } | null>(null);

  /** Paleta de módulos (Ctrl/⌘ K). */
  readonly paletaAbierta = signal(false);
  readonly atajoTexto = esMac ? '⌘K' : 'Ctrl K';

  readonly grupos = computed(() => {
    const visibles = modulosAccesibles(this.panel, this.auth.permisos());
    return this.panel.grupos.map((grupo) => ({ ...grupo, modulos: visibles.filter((m) => m.grupo === grupo.id) }))
      .filter((grupo) => grupo.modulos.length > 0);
  });

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Módulo activo para la miga de pan. */
  readonly moduloActual = computed(() => moduloDeUrl(this.panel, this.url()) ?? null);

  /** Destino de la miga raíz: la entrada del panel (primer módulo accesible). */
  readonly inicio = computed(() => {
    const modulo = primerModuloAccesible(this.panel, this.auth.permisos());
    return modulo ? urlModulo(this.panel, modulo) : '/';
  });

  constructor() {
    const alCambiarAncho = (evento: MediaQueryListEvent) => {
      this.escritorio.set(evento.matches);
      if (evento.matches) {
        this.menuAbierto.set(false);
      }
    };
    this.consultaEscritorio.addEventListener('change', alCambiarAncho);
    inject(DestroyRef).onDestroy(() => this.consultaEscritorio.removeEventListener('change', alCambiarAncho));

    // Tras navegar, el foco va al título de la nueva página (lectores y teclado saben dónde están).
    this.router.events
      .pipe(
        filter((evento) => evento instanceof NavigationEnd),
        skip(1),
        takeUntilDestroyed(),
      )
      .subscribe(() =>
        setTimeout(() => document.querySelector<HTMLElement>('#contenido h1')?.focus({ preventScroll: true })),
      );
  }

  alternarMenu(): void {
    this.menuAbierto.update((valor) => !valor);
    if (this.menuAbierto()) {
      setTimeout(() => this.navegacion()?.nativeElement.querySelector<HTMLElement>('a')?.focus());
    }
  }

  alNavegar(): void {
    this.menuAbierto.set(false);
    this.conmutadorAbierto.set(false);
  }

  alternarConmutador(): void {
    this.conmutadorAbierto.update((valor) => !valor);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  cerrarConEscape(): void {
    if (this.conmutadorAbierto()) {
      this.conmutadorAbierto.set(false);
      return;
    }
    // Los modales gestionan su propio Escape.
    if (document.querySelector('.ui-modal') || !this.menuAbierto()) {
      return;
    }
    this.cerrarMenu();
    // Tras el render: el cuerpo deja de ser inert y el botón ya acepta el foco.
    setTimeout(() => this.botonMenu()?.nativeElement.focus());
  }

  alternarCompacta(): void {
    this.compacta.update((valor) => !valor);
    this.tip.set(null);
    try {
      localStorage.setItem(CLAVE_COMPACTA, String(this.compacta()));
    } catch {
      /* almacenamiento no disponible */
    }
  }

  mostrarTip(evento: Event, texto: string): void {
    if (!this.escritorio() || !this.compacta()) {
      return;
    }
    const caja = (evento.currentTarget as HTMLElement).getBoundingClientRect();
    this.tip.set({ texto, y: caja.top + caja.height / 2 });
  }

  ocultarTip(): void {
    this.tip.set(null);
  }

  abrirPaleta(): void {
    this.menuAbierto.set(false);
    this.paletaAbierta.set(true);
  }

  /** Ctrl/⌘ K abre la paleta (si no hay otro diálogo abierto). */
  atajo(evento: KeyboardEvent): void {
    if ((evento.metaKey || evento.ctrlKey) && evento.key.toLowerCase() === 'k') {
      if (document.querySelector('.ui-modal')) {
        return;
      }
      evento.preventDefault();
      if (this.paletaAbierta()) {
        this.paletaAbierta.set(false);
      } else {
        this.abrirPaleta();
      }
    }
  }

  private leerCompacta(): boolean {
    try {
      return localStorage.getItem(CLAVE_COMPACTA) === 'true';
    } catch {
      return false;
    }
  }

  alternarTema(evento: Event): void {
    this.tema.alternar(evento);
  }
}
