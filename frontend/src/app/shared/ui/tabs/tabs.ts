import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface TabLink {
  label: string;
  /** Ruta relativa a la página que contiene las pestañas. */
  path: string;
  /** Contador opcional al lado del texto (p. ej. eventos sin leer). */
  count?: number;
}

/**
 * Pestañas como enlaces de ruta: cada pestaña es una URL (se comparte, recarga y vuelve con Atrás).
 *   <app-tabs label="Secciones del servicio" [tabs]="tabs" />
 *   <router-outlet />
 */
@Component({
  selector: 'app-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav [attr.aria-label]="label()">
      @for (tab of tabs(); track tab.path) {
        <a [routerLink]="tab.path" routerLinkActive="is-active" ariaCurrentWhenActive="page">
          {{ tab.label }}
          @if (tab.count !== undefined) {
            <span class="count">{{ tab.count }}</span>
          }
        </a>
      }
    </nav>
  `,
  styleUrl: './tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tabs {
  readonly label = input.required<string>();
  readonly tabs = input.required<readonly TabLink[]>();
}
