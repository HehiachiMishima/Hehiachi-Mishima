import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../icon/icon';

@Component({
  selector: 'ui-empty',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="ui-empty">
      <span class="ui-empty__icon" aria-hidden="true">
        <ui-icon [name]="icono()" [size]="20" />
      </span>
      <p class="ui-empty__title">{{ titulo() }}</p>
      @if (mensaje()) {
        <p class="ui-empty__text">{{ mensaje() }}</p>
      }
      <div class="ui-empty__acciones"><ng-content /></div>
    </div>
  `,
})
export class EmptyState {
  readonly icono = input<string>('layers');
  readonly titulo = input<string>('Sin datos');
  readonly mensaje = input<string>('');
}
