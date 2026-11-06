import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';
import { Modal } from '../modal/modal';

let secuencia = 0;

/**
 * Confirmación de acciones destructivas o con impacto masivo. El foco inicial
 * va a "Cancelar" (opción menos destructiva) y el impacto se describe antes de
 * confirmar. El contenido proyectado amplía la explicación (p. ej. el alcance).
 */
@Component({
  selector: 'ui-confirmacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal, Icon, Button],
  template: `
    <ui-modal [abierto]="abierto()" ancho="sm" [compacto]="true" [alerta]="true" [titulo]="titulo()" (cerrar)="cancelar.emit()">
      <div class="confirm">
        <span class="confirm__icon" [class.confirm__icon--neutral]="!peligro()" aria-hidden="true">
          <ui-icon [name]="icono()" [size]="20" />
        </span>
        <div class="confirm__text">
          <p class="confirm__title">{{ pregunta() }}</p>
          @if (descripcion()) {
            <p class="confirm__desc">{{ descripcion() }}</p>
          }
          <ng-content />
          @if (conMotivo()) {
            <div class="ui-field confirm__motivo">
              <label class="ui-label" [for]="idMotivo">Motivo <span class="u-muted">(opcional, queda en la auditoría)</span></label>
              <textarea [id]="idMotivo" class="ui-textarea" maxlength="200" [value]="motivo()"
                (input)="motivo.set($any($event.target).value)"></textarea>
            </div>
          }
        </div>
      </div>
      <div modal-footer class="modal-foot">
        <button type="button" appButton variant="ghost" data-autofocus (click)="cancelar.emit()">Cancelar</button>
        <button
          type="button"
          appButton
          [variant]="peligro() ? 'danger' : 'primary'"
          [attr.aria-disabled]="procesando() || null"
          [attr.aria-busy]="procesando() || null"
          (click)="!procesando() && confirmar.emit(motivo().trim())"
        >
          @if (procesando()) {
            <span class="ui-spinner ui-spinner--sm" aria-hidden="true"></span>
          }
          {{ etiqueta() }}
        </button>
      </div>
    </ui-modal>
  `,
})
export class Confirmacion {
  readonly abierto = input(false);
  readonly titulo = input.required<string>();
  readonly pregunta = input.required<string>();
  readonly descripcion = input('');
  readonly etiqueta = input('Confirmar');
  readonly icono = input('alertTriangle');
  readonly peligro = input(true);
  readonly procesando = input(false);
  /** Muestra un campo "Motivo" opcional; su texto se emite al confirmar. */
  readonly conMotivo = input(false);

  readonly confirmar = output<string>();
  readonly cancelar = output<void>();

  readonly idMotivo = `confirm-motivo-${++secuencia}`;
  readonly motivo = signal('');

  constructor() {
    effect(() => {
      if (this.abierto()) {
        this.motivo.set('');
      }
    });
  }
}
