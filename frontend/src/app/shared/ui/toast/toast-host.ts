import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Notificacion, Notificaciones, TipoNotificacion } from '../../../core/services/notificaciones';
import { Icon } from '../icon/icon';

const ICONO_POR_TIPO: Record<TipoNotificacion, string> = {
  exito: 'checkCircleFilled',
  error: 'xCircle',
  info: 'info',
  advertencia: 'alertTriangle',
};

/**
 * Pila de avisos. El anuncio a lectores de pantalla lo hacen las live regions
 * persistentes del Anunciador (no hay regiones anidadas aquí). Pasar el puntero
 * o el foco sobre los avisos detiene su cierre automático.
 */
@Component({
  selector: 'ui-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div
      class="ui-toast-host"
      (mouseenter)="notificaciones.pausar()"
      (mouseleave)="notificaciones.reanudar()"
      (focusin)="notificaciones.pausar()"
      (focusout)="notificaciones.reanudar()"
    >
      @for (aviso of notificaciones.items(); track aviso.id) {
        <div class="ui-toast" [class]="'ui-toast--' + aviso.tipo">
          <span class="ui-toast__icon" aria-hidden="true">
            <ui-icon [name]="icono(aviso.tipo)" [size]="20" />
          </span>
          <div class="ui-toast__body">
            <div class="ui-toast__title">{{ aviso.titulo }}</div>
            @if (aviso.mensaje) {
              <div class="ui-toast__text">{{ aviso.mensaje }}</div>
            }
            @if (aviso.accion) {
              <button type="button" class="ui-toast__action" (click)="ejecutar(aviso)">
                {{ aviso.accion.etiqueta }}
              </button>
            }
          </div>
          <button
            type="button"
            class="ui-icon-btn ui-toast__close"
            (click)="notificaciones.cerrar(aviso.id)"
            [attr.aria-label]="'Cerrar aviso: ' + aviso.titulo"
          >
            <ui-icon name="close" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHost {
  readonly notificaciones = inject(Notificaciones);

  icono(tipo: TipoNotificacion): string {
    return ICONO_POR_TIPO[tipo];
  }

  ejecutar(aviso: Notificacion): void {
    this.notificaciones.cerrar(aviso.id);
    aviso.accion?.ejecutar();
  }
}
