import { CdkMenu, CdkMenuItem } from '@angular/cdk/menu';
import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Menú desplegable sobre CDK Menu (teclado, foco, cierre con Esc y clic fuera ya resueltos).
 *   <button appButton variant="secondary" [cdkMenuTriggerFor]="acciones">Acciones</button>
 *   <ng-template #acciones>
 *     <div appMenu>
 *       <button appMenuItem (cdkMenuItemTriggered)="editar()">Editar</button>
 *       <button appMenuItem [selected]="true">Ordenar por nombre</button>
 *       <app-menu-separator />
 *       <button appMenuItem tone="danger" (cdkMenuItemTriggered)="eliminar()">Eliminar</button>
 *     </div>
 *   </ng-template>
 * Quien abre el menú importa CdkMenuTrigger de '@angular/cdk/menu'.
 */
@Component({
  selector: '[appMenu]',
  hostDirectives: [CdkMenu],
  template: `<ng-content />`,
  styleUrl: './menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Menu {}

@Component({
  selector: 'button[appMenuItem], a[appMenuItem]',
  hostDirectives: [
    { directive: CdkMenuItem, inputs: ['cdkMenuItemDisabled: disabled'], outputs: ['cdkMenuItemTriggered'] },
  ],
  template: `<ng-content />`,
  styleUrl: './menu-item.scss',
  host: {
    '[class.is-selected]': 'selected()',
    '[class.is-danger]': 'tone() === "danger"',
    '[attr.aria-current]': 'selected() || null',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuItem {
  /** Opción vigente (orden, filtro, vista): fondo violeta suave y texto violeta. */
  readonly selected = input(false, { transform: booleanAttribute });
  readonly tone = input<'neutral' | 'danger'>('neutral');
}

@Component({
  selector: 'app-menu-separator',
  template: ``,
  styles: `
    @use 'design' as d;

    :host {
      display: block;
      margin: d.space('2') d.space('3');
      border-top: 1px solid d.color('border');
    }
  `,
  host: { role: 'separator' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuSeparator {}
