import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TemaService } from '../../core/services/tema';
import { MenuCuenta } from '../../features/cuenta/menu-cuenta';
import { Icon } from '../../shared/ui/icon/icon';

/** Marco de las vistas que no pertenecen a ningún panel: selector de paneles y acceso denegado global. */
@Component({
  selector: 'app-portal',
  imports: [RouterOutlet, RouterLink, Icon, MenuCuenta],
  template: `
    <header class="topbar">
      <a class="cell marca" routerLink="/">
        <img src="logoImg.png" alt="" width="20" height="20" />
        <span>Hehiachi Mishima</span>
      </a>
      <div class="topbar__fin">
        <button
          type="button"
          class="cell cell--icono"
          (click)="tema.alternar($event)"
          [attr.aria-label]="tema.tema() === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'"
        >
          <ui-icon [name]="tema.tema() === 'dark' ? 'sun' : 'moon'" [size]="16" />
        </button>
        <app-menu-cuenta />
      </div>
    </header>
    <main id="contenido" class="contenido" tabindex="-1">
      <router-outlet />
    </main>
  `,
  styleUrl: './portal.scss',
})
export class Portal {
  readonly tema = inject(TemaService);
}
