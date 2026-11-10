import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Auth } from '../../core/services/auth';
import { SesionVigilante } from '../../core/services/sesion-vigilante';
import { Modal } from '../../shared/ui/modal/modal';
import { Button } from '../../shared/ui/button/button';

const HORA = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });

/**
 * Aviso de cierre por inactividad (WCAG 2.2.1): una sola acción para seguir.
 * Cerrar el aviso (Esc o ✕) también cuenta como "seguir conectado".
 */
@Component({
  selector: 'app-aviso-sesion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal, Button],
  template: `
    <ui-modal [abierto]="!!vigilante.aviso()" ancho="sm" [compacto]="true" [alerta]="true"
      titulo="¿Sigues ahí?" (cerrar)="vigilante.seguirConectado()">
      <p>
        No detectamos actividad. Por seguridad, tu sesión se cerrará a las <strong>{{ hora() }}</strong>.
        Si sigues trabajando, no tendrás que volver a escribir tu contraseña.
      </p>
      <div modal-footer class="modal-foot">
        <button type="button" appButton variant="ghost" (click)="cerrarSesion()">Cerrar sesión</button>
        <button type="button" appButton data-autofocus (click)="vigilante.seguirConectado()">Seguir conectado</button>
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
    this.vigilante.aviso.set(null);
    this.auth.cerrarSesion();
  }
}
