import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Estilo único de botones sobre el <button> o <a> nativo (conserva teclado, foco y formularios).
 *   <button appButton>Desplegar</button>                         principal: negro → violeta
 *   <button appButton variant="secondary">Conectar</button>      contorno → se invierte al pasar
 *   <button appButton variant="tertiary">Invitar equipo</button> texto violeta, sin borde
 *   <button appButton variant="ghost" size="sm">Editar</button>  texto neutro, sin borde
 *   <button appButton variant="danger">Eliminar</button>
 */
@Component({
  selector: 'button[appButton], a[appButton]',
  template: `
    @if (loading()) {
      <span class="spinner" aria-hidden="true"></span>
    }
    <ng-content />
  `,
  styleUrl: './button.scss',
  host: {
    '[class]': '"btn--" + variant() + " btn--" + size()',
    '[attr.aria-busy]': 'loading() || null',
    '[attr.disabled]': 'loading() || null',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Button {
  readonly variant = input<'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger'>('primary');
  readonly size = input<'sm' | 'md'>('md');
  readonly loading = input(false);
}
