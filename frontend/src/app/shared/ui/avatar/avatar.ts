import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Avatar circular con iniciales. Decorativo: el nombre ya se muestra o se anuncia al lado.
 *   <app-avatar [name]="usuario.nombre" />         20 px (barra superior)
 *   <app-avatar [name]="miembro.nombre" size="lg" />
 */
@Component({
  selector: 'app-avatar',
  template: `{{ initials() }}`,
  styleUrl: './avatar.scss',
  host: { '[class]': '"avatar--" + size()', 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Avatar {
  readonly name = input.required<string>();
  readonly size = input<'sm' | 'md' | 'lg'>('sm');

  protected readonly initials = computed(() =>
    this.name()
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toLocaleUpperCase())
      .join(''),
  );
}
