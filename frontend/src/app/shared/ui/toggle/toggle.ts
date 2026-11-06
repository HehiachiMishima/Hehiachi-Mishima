import { booleanAttribute, ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/**
 * Interruptor encendido/apagado (role="switch"). El texto visible se proyecta.
 *   <app-toggle [(checked)]="autoDeploy">Despliegue automático</app-toggle>
 */
@Component({
  selector: 'app-toggle',
  template: `
    <button
      type="button"
      role="switch"
      class="track"
      [attr.aria-checked]="checked()"
      [attr.aria-labelledby]="labelId"
      [disabled]="disabled()"
      (click)="checked.set(!checked())"
    >
      <span class="handle" aria-hidden="true"></span>
    </button>
    <span class="label" [id]="labelId" (click)="!disabled() && checked.set(!checked())"><ng-content /></span>
  `,
  styleUrl: './toggle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toggle {
  private static nextId = 0;

  readonly checked = model(false);
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly labelId = `app-toggle-${Toggle.nextId++}`;
}
