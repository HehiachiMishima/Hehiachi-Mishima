import { CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Auth } from '../../core/services/auth';
import { Avatar } from '../../shared/ui/avatar/avatar';
import { Icon } from '../../shared/ui/icon/icon';
import { Menu, MenuItem, MenuSeparator } from '../../shared/ui/menu/menu';
import { CambiarContrasena } from './cambiar-contrasena';

/**
 * Celda de la cuenta en la barra superior: avatar, nombre y menú (CDK) con cambiar contraseña
 * y cerrar sesión. El teclado, el foco y el cierre con Esc/clic fuera los resuelve CDK Menu.
 */
@Component({
  selector: 'app-menu-cuenta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkMenuTrigger, Avatar, Icon, Menu, MenuItem, MenuSeparator, CambiarContrasena],
  template: `
    @if (usuario(); as u) {
      <button type="button" class="cuenta" [cdkMenuTriggerFor]="menu" aria-haspopup="menu">
        <app-avatar [name]="nombreCompleto()" />
        <span class="cuenta__nombre">{{ nombreCompleto() }}</span>
        <ui-icon name="chevronDown" [size]="16" />
        <span class="u-sr-only">Menú de la cuenta</span>
      </button>

      <ng-template #menu>
        <div appMenu class="cuenta-menu">
          <div class="cuenta-menu__cabecera" aria-hidden="true">
            <span class="cuenta-menu__nombre">{{ nombreCompleto() }}</span>
            <span class="cuenta-menu__mail">{{ u.email }}</span>
          </div>
          <app-menu-separator />
          <button appMenuItem (cdkMenuItemTriggered)="abrirContrasena()">
            <ui-icon name="key" [size]="16" /> Cambiar contraseña
          </button>
          <app-menu-separator />
          <button appMenuItem tone="danger" (cdkMenuItemTriggered)="cerrarSesion()">
            <ui-icon name="logout" [size]="16" /> Cerrar sesión
          </button>
        </div>
      </ng-template>

      <app-cambiar-contrasena [abierto]="contrasenaAbierta()" (cerrar)="contrasenaAbierta.set(false)" />
    }
  `,
  styles: `
    @use 'design' as d;

    :host {
      display: flex;
      align-items: stretch;
    }

    .cuenta {
      display: inline-flex;
      align-items: center;
      gap: d.space('2');
      min-width: d.layout('topbar-height');
      padding: 0 d.space('4');
      border: 0;
      background: transparent;
      @include d.type('interface-00');
      color: d.color('text');
      cursor: pointer;
      transition: background-color d.motion('fast') d.motion('easing');
      @include d.focus-ring(-2px);

      &:hover,
      &[aria-expanded='true'] {
        background: d.color('surface-hover');
      }

      ui-icon {
        color: d.color('text-faint');
      }
    }

    .cuenta__nombre {
      display: none;
      max-width: 12rem;
      @include d.truncate;

      @include d.bp('md') {
        display: block;
      }
    }

    .cuenta-menu__cabecera {
      display: grid;
      gap: 2px;
      padding: d.space('2') d.space('3');
      min-width: 0;
    }

    .cuenta-menu__nombre {
      @include d.type('body-01-medium');
      color: d.color('text-strong');
      @include d.truncate;
    }

    .cuenta-menu__mail {
      @include d.type('body-00');
      color: d.color('text-muted');
      @include d.truncate;
    }
  `,
})
export class MenuCuenta {
  private readonly auth = inject(Auth);

  readonly usuario = this.auth.usuario;
  readonly contrasenaAbierta = signal(false);
  readonly nombreCompleto = computed(() => {
    const u = this.usuario();
    return u ? `${u.nombre} ${u.apellido}`.trim() : '';
  });

  abrirContrasena(): void {
    this.contrasenaAbierta.set(true);
  }

  cerrarSesion(): void {
    this.auth.cerrarSesion();
  }
}
