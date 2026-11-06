import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Auth } from '../../core/services/auth';
import { SesionVigilante } from '../../core/services/sesion-vigilante';
import { Modal } from '../../shared/ui/modal/modal';
import { Button } from '../../shared/ui/button/button';

const HORA = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });

/** Aviso previo al vencimiento de la sesión (WCAG 2.2.1). */
@Component({
  selector: 'app-aviso-sesion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal, Button],
  template: `
    <ui-modal [abierto]="!!vigilante.aviso()" ancho="sm" [compacto]="true" [alerta]="true"
      titulo="Tu sesión está por vencer" (cerrar)="vigilante.descartarAviso()">
      <p>
        Tu sesión vencerá a las <strong>{{ hora() }}</strong>. Guarda los cambios pendientes:
        después tendrás que volver a iniciar sesión.
      </p>
      <div modal-footer class="modal-foot">
        <button type="button" appButton variant="ghost" (click)="cerrarSesion()">Cerrar sesión ahora</button>
        <button type="button" appButton data-autofocus (click)="vigilante.descartarAviso()">Entendido</button>
      </div>
    </ui-modal>
  `,
})
export class AvisoSesion {
  protected readonly vigilante = inject(SesionVigilante);
  private readonly auth = inject(Auth);

  readonly hora = computed(() => {
    const aviso = this.vigilante.aviso();
    return aviso ? HORA.format(aviso) : '';
  });

  cerrarSesion(): void {
    this.vigilante.descartarAviso();
    this.auth.cerrarSesion();
  }
}
