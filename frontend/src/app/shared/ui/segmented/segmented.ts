import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Selector segmentado (filtros rápidos tipo "Activos (2) | Suspendidos (0) | Todos (2)").
 *   <app-segmented label="Estado" [options]="opciones" [(value)]="estado" />
 * Accesible como grupo de radio: flechas para moverse, Tab para salir.
 */
@Component({
  selector: 'app-segmented',
  template: `
    @for (option of options(); track option.value) {
      <button
        type="button"
        role="radio"
        [attr.aria-checked]="option.value === value()"
        [tabIndex]="option.value === value() ? 0 : -1"
        (click)="value.set(option.value)"
        (keydown.arrowRight)="move($index, 1, $event)"
        (keydown.arrowLeft)="move($index, -1, $event)"
      >
        {{ option.label }}
      </button>
    }
  `,
  styleUrl: './segmented.scss',
  host: { role: 'radiogroup', '[attr.aria-label]': 'label()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Segmented<T extends string> {
  readonly options = input.required<readonly SegmentedOption<T>[]>();
  readonly label = input.required<string>();
  readonly value = model.required<T>();

  protected move(index: number, step: number, event: Event): void {
    const options = this.options();
    const next = options[(index + step + options.length) % options.length];
    this.value.set(next.value);
    const host = (event.target as HTMLElement).parentElement;
    (host?.children[options.indexOf(next)] as HTMLElement | undefined)?.focus();
  }
}
