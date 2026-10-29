import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Auth } from '../../core/services/auth';
import { iniciales } from '../../shared/util/formato';
import { Icon } from '../../shared/ui/icon/icon';
import { CambiarContrasena } from './cambiar-contrasena';

/** Menú de la cuenta en la barra superior: cambiar contraseña y cerrar sesión. */
@Component({
  selector: 'app-menu-cuenta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, CambiarContrasena],
  host: {
    '(document:click)': 'alClicFuera($event)',
    '(keydown.escape)': 'cerrarMenu(true)',
  },
  template: `
    @if (usuario(); as u) {
      <div class="menu-cuenta">
        <button #disparador type="button" class="menu-cuenta__btn" aria-haspopup="true"
          [attr.aria-expanded]="abierto()" aria-controls="menu-cuenta-lista" (click)="abierto.update((v) => !v)">
          <span class="ui-avatar" aria-hidden="true">{{ iniciales() }}</span>
          <span class="menu-cuenta__info">
            <span class="menu-cuenta__nombre">{{ u.nombre }} {{ u.apellido }}</span>
            <span class="menu-cuenta__mail">{{ u.email }}</span>
          </span>
          <span class="u-sr-only">Menú de la cuenta</span>
        </button>
        @if (abierto()) {
          <ul id="menu-cuenta-lista" class="menu-cuenta__lista">
            <li>
              <button type="button" class="menu-cuenta__item" (click)="abrirContrasena()">
                <ui-icon name="key" [size]="16" /> Cambiar contraseña
              </button>
            </li>
            <li>
              <button type="button" class="menu-cuenta__item" (click)="cerrarSesion()">
                <ui-icon name="logout" [size]="16" /> Cerrar sesión
              </button>
            </li>
          </ul>
        }
      </div>
      <app-cambiar-contrasena [abierto]="contrasenaAbierta()" (cerrar)="contrasenaAbierta.set(false)" />
    }
  `,
})
export class MenuCuenta {
  private readonly auth = inject(Auth);
  private readonly anfitrion = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly disparador = viewChild<ElementRef<HTMLButtonElement>>('disparador');

  readonly usuario = this.auth.usuario;
  readonly abierto = signal(false);
  readonly contrasenaAbierta = signal(false);
  readonly iniciales = computed(() => iniciales(this.usuario()?.nombre, this.usuario()?.apellido));

  cerrarMenu(devolverFoco = false): void {
    if (!this.abierto()) {
      return;
    }
    this.abierto.set(false);
    if (devolverFoco) {
      this.disparador()?.nativeElement.focus();
    }
  }

  alClicFuera(evento: MouseEvent): void {
    if (!this.anfitrion.nativeElement.contains(evento.target as Node)) {
      this.cerrarMenu();
    }
  }

  abrirContrasena(): void {
    this.abierto.set(false);
    this.contrasenaAbierta.set(true);
  }

  cerrarSesion(): void {
    this.abierto.set(false);
    this.auth.cerrarSesion();
  }
}
