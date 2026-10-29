import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, skip } from 'rxjs';
import { GrupoModulo, NOMBRE_GRUPO, PANEL_ADMIN, panelesAccesibles } from '../../../core/config/paneles';
import { Auth } from '../../../core/services/auth';
import { TemaService } from '../../../core/services/tema';
import { MenuCuenta } from '../../cuenta/menu-cuenta';
import { Icon } from '../../../shared/ui/icon/icon';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, MenuCuenta],
  host: {
    '(document:keydown.escape)': 'cerrarConEscape()',
  },
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.scss',
})
export class AdminShell {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  readonly tema = inject(TemaService);

  private readonly botonMenu = viewChild<ElementRef<HTMLButtonElement>>('botonMenu');
  private readonly navegacion = viewChild<ElementRef<HTMLElement>>('navegacion');

  readonly panel = PANEL_ADMIN;
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

  readonly grupos = computed(() => {
    const permisos = this.auth.permisos();
    const visibles = this.panel.modulos.filter((modulo) => permisos.includes(modulo.permiso));
    return (Object.keys(NOMBRE_GRUPO) as GrupoModulo[])
      .map((grupo) => ({ id: grupo, nombre: NOMBRE_GRUPO[grupo], modulos: visibles.filter((m) => m.grupo === grupo) }))
      .filter((grupo) => grupo.modulos.length > 0);
  });

  /** Índice de animación en cascada de cada elemento de la navegación. */
  readonly totalNavegacion = computed(() =>
    this.grupos().reduce((total, grupo) => total + grupo.modulos.length + 1, 0),
  );

  readonly variosPaneles = computed(() => panelesAccesibles(this.auth.permisos()).length > 1);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Módulo activo para la miga de pan. */
  readonly moduloActual = computed(() => {
    const ruta = this.url().split(/[?#]/)[0];
    return this.panel.modulos.find((modulo) => ruta.startsWith(`${this.panel.ruta}/${modulo.ruta}`)) ?? null;
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

  posicion(grupo: number, indice: number): number {
    const previos = this.grupos()
      .slice(0, grupo)
      .reduce((total, actual) => total + actual.modulos.length + 1, 0);
    return previos + indice + 2;
  }

  alternarMenu(): void {
    this.menuAbierto.update((valor) => !valor);
    if (this.menuAbierto()) {
      setTimeout(() => this.navegacion()?.nativeElement.querySelector<HTMLElement>('a')?.focus());
    }
  }

  alNavegar(): void {
    this.menuAbierto.set(false);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  cerrarConEscape(): void {
    // Los modales gestionan su propio Escape.
    if (document.querySelector('.ui-modal') || !this.menuAbierto()) {
      return;
    }
    this.cerrarMenu();
    // Tras el render: el cuerpo deja de ser inert y el botón ya acepta el foco.
    setTimeout(() => this.botonMenu()?.nativeElement.focus());
  }

  alternarTema(evento: Event): void {
    this.tema.alternar(evento);
  }

  irAPaneles(): void {
    void this.router.navigateByUrl('/');
  }
}
