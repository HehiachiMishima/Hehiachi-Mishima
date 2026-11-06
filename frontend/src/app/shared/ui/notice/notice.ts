import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Icon } from '../icon/icon';

export type NoticeTone = 'accent' | 'success' | 'warning' | 'danger';

const ICONOS: Record<NoticeTone, string> = {
  accent: 'info',
  success: 'checkCircleFilled',
  warning: 'alertTriangle',
  danger: 'xCircle',
};

/**
 * Aviso de ancho completo con fondo suave del tono. El texto y el enlace se proyectan.
 *   <app-notice>Hay una nueva versión. <a href="…">Ver cambios</a></app-notice>
 *   <app-notice tone="danger" dismissible (dismissed)="cerrar()">No se pudo guardar.</app-notice>
 * `role="alert"` en danger; `status` en los demás (`silent` lo omite si ya lo anuncia otra región).
 */
@Component({
  selector: 'app-notice',
  imports: [Icon],
  template: `
    <ui-icon class="tone-icon" [name]="icono()" [size]="18" />
    <div class="body"><ng-content /></div>
    @if (dismissible()) {
      <button type="button" class="close" aria-label="Cerrar aviso" (click)="dismissed.emit()">
        <ui-icon name="close" [size]="16" />
      </button>
    }
  `,
  styleUrl: './notice.scss',
  host: {
    '[class]': '"notice--" + tone()',
    '[attr.role]': 'silent() ? null : tone() === "danger" ? "alert" : "status"',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Notice {
  readonly tone = input<NoticeTone>('accent');
  readonly dismissible = input(false, { transform: booleanAttribute });
  readonly silent = input(false, { transform: booleanAttribute });
  readonly dismissed = output<void>();

  protected readonly icono = computed(() => ICONOS[this.tone()]);
}
