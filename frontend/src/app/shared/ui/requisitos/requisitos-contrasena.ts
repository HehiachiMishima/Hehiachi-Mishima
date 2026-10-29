import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { REGLAS_CONTRASENA } from '../../forms/validadores';
import { Icon } from '../icon/icon';

/** Requisitos de la contraseña con su cumplimiento en vivo (texto + icono, no solo color). */
@Component({
  selector: 'ui-requisitos-contrasena',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <ul class="requisitos" [id]="id()">
      @for (regla of reglas; track regla.id) {
        <li class="requisitos__item" [class.requisitos__item--ok]="regla.cumple(valor())">
          <ui-icon [name]="regla.cumple(valor()) ? 'check' : 'close'" [size]="14" />
          {{ regla.texto }}
          <span class="u-sr-only">{{ regla.cumple(valor()) ? '(cumplido)' : '(pendiente)' }}</span>
        </li>
      }
    </ul>
  `,
  styles: `
    .requisitos { display: flex; flex-direction: column; gap: 2px; font-size: var(--fs-xs); color: var(--text-2); }
    .requisitos__item { display: flex; align-items: center; gap: var(--space-1); }
    .requisitos__item--ok { color: var(--success); }
  `,
})
export class RequisitosContrasena {
  readonly valor = input('');
  readonly id = input.required<string>();
  readonly reglas = REGLAS_CONTRASENA;
}
