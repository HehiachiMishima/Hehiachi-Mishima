import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Etiqueta de estado o de tipo: rectangular, fondo suave y texto del mismo tono.
 *   <app-badge tone="success">Desplegado</app-badge>
 *   <app-badge>Docker</app-badge>
 *   <app-badge tone="accent" size="md">Gratis</app-badge>
 * Puede llevar un <ui-icon [size]="12"> antes del texto.
 */
@Component({
  selector: 'app-badge',
  template: '<ng-content />',
  styleUrl: './badge.scss',
  host: { '[class]': '"badge--" + tone() + " badge--" + size()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Badge {
  readonly tone = input<'neutral' | 'accent' | 'success' | 'warning' | 'danger'>('neutral');
  readonly size = input<'sm' | 'md'>('sm');
}
