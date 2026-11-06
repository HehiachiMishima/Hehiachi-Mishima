import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

import { Icon } from '../icon/icon';

/**
 * Campo de búsqueda con lupa a la izquierda. El label es obligatorio (se oculta a la vista).
 *   <app-search-field label="Buscar servicios" placeholder="Buscar" [(value)]="termino" />
 * Aplica debounce en el store, no aquí: el campo solo refleja lo que se escribe.
 */
@Component({
  selector: 'app-search-field',
  imports: [Icon],
  template: `
    <label class="visually-hidden" [for]="inputId">{{ label() }}</label>
    <ui-icon name="search" [size]="16" />
    <input
      type="search"
      autocomplete="off"
      [id]="inputId"
      [placeholder]="placeholder()"
      [value]="value()"
      (input)="value.set($any($event.target).value)"
    />
  `,
  styleUrl: './search-field.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchField {
  private static nextId = 0;

  readonly label = input.required<string>();
  readonly placeholder = input('Buscar');
  readonly value = model('');

  protected readonly inputId = `app-search-${SearchField.nextId++}`;
}
