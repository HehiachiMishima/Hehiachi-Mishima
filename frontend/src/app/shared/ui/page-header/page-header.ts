import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Icon } from '../icon/icon';

/**
 * Encabezado de página: eyebrow mono, h1 y, a la derecha, las acciones. Debajo, metadatos opcionales.
 *   <app-page-header eyebrow="Panel Administración" heading="Usuarios">
 *     <ng-container pageMeta>…descripción, ids, badges…</ng-container>
 *     <ng-container pageActions><button appButton>Nuevo usuario</button></ng-container>
 *   </app-page-header>
 * kind: 'overview' (32 px, páginas de listado) | 'detail' (28 px, detalle de un registro).
 * El h1 acepta foco programático (tabindex -1): el shell lo enfoca tras cada navegación.
 */
@Component({
  selector: 'app-page-header',
  imports: [Icon],
  template: `
    <div class="titles">
      @if (eyebrow()) {
        <span class="eyebrow">
          @if (eyebrowIcon(); as icono) {
            <ui-icon [name]="icono" [size]="16" />
          }
          {{ eyebrow() }}
        </span>
      }
      <h1 tabindex="-1">{{ heading() }}</h1>
      <div class="meta"><ng-content select="[pageMeta]" /></div>
    </div>
    <div class="actions"><ng-content select="[pageActions]" /></div>
  `,
  styleUrl: './page-header.scss',
  host: { '[class.is-detail]': 'kind() === "detail"' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeader {
  readonly heading = input.required<string>();
  readonly eyebrow = input<string>();
  readonly eyebrowIcon = input<string>();
  readonly kind = input<'overview' | 'detail'>('overview');
}
