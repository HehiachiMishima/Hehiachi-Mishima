import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../shared/ui/icon/icon';

export interface Miga {
  etiqueta: string;
  /** Sin url, el tramo es el actual (no navegable). */
  url?: string;
}

/**
 * Migas de pan de la barra superior. Las rutas de los paneles se generan desde el registro
 * (paneles/registro.ts), así que el shell calcula los tramos y los pasa aquí.
 */
@Component({
  selector: 'app-breadcrumbs',
  imports: [RouterLink, Icon],
  template: `
    <nav aria-label="Ruta de navegación">
      <ol>
        @for (miga of items(); track $index; let ultimo = $last) {
          <li>
            @if (ultimo || !miga.url) {
              <span class="current" [attr.aria-current]="ultimo ? 'page' : null">{{ miga.etiqueta }}</span>
            } @else {
              <a [routerLink]="miga.url">{{ miga.etiqueta }}</a>
            }
            @if (!ultimo) {
              <ui-icon name="chevronRight" [size]="16" />
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styleUrl: './breadcrumbs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Breadcrumbs {
  readonly items = input.required<readonly Miga[]>();
}
