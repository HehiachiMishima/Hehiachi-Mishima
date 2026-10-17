import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from '../icon/icon';

export type AnchoModal = 'sm' | 'md' | 'lg';

@Component({
  selector: 'ui-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @if (abierto()) {
      <div class="ui-modal-backdrop" (click)="alClicFondo($event)" tabindex="-1">
        <section
          class="ui-modal"
          [class]="'ui-modal--' + ancho()"
          [class.ui-modal--compacto]="compacto()"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="titulo()"
        >
          <header class="ui-modal__header">
            <div class="ui-modal__heading">
              <h2 class="ui-modal__title">{{ titulo() }}</h2>
              @if (subtitulo()) {
                <p class="ui-modal__subtitle">{{ subtitulo() }}</p>
              }
            </div>
            <button type="button" class="ui-icon-btn" (click)="cerrar.emit()" aria-label="Cerrar">
              <ui-icon name="close" [size]="18" />
            </button>
          </header>

          <div class="ui-modal__body">
            <ng-content />
          </div>

          <div class="ui-modal__footer">
            <ng-content select="[modal-footer]" />
          </div>
        </section>
      </div>
    }
  `,
})
export class Modal {
  readonly abierto = input(false);
  readonly titulo = input('');
  readonly subtitulo = input('');
  readonly ancho = input<AnchoModal>('md');
  readonly compacto = input(false);
  readonly cerrar = output<void>();

  alClicFondo(evento: MouseEvent): void {
    if (evento.target === evento.currentTarget) {
      this.cerrar.emit();
    }
  }
}
