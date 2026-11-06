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
    <div class="portal">
      <header class="portal__bar">
        <a class="portal__brand" routerLink="/">
          <img src="logoImg.png" alt="" width="28" height="28" />
          <span>Hehiachi Mishima</span>
        </a>
        <div class="portal__acciones">
          <button
            type="button"
            class="ui-icon-btn"
            (click)="tema.alternar($event)"
            [attr.aria-label]="tema.tema() === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'"
          >
            <ui-icon [name]="tema.tema() === 'dark' ? 'sun' : 'moon'" [size]="18" />
          </button>
          <app-menu-cuenta />
        </div>
      </header>
      <main id="contenido" class="portal__contenido" tabindex="-1">
        <router-outlet />
      </main>
    </div>
  `,
  styleUrl: './portal.scss',
})
export class Portal {
  readonly tema = inject(TemaService);
}
