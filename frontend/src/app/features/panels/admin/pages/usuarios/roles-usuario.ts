import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';
import { Rol, Usuario } from '../../../../../core/models';
import { Notificaciones } from '../../../../../core/services/notificaciones';
import { RolesApi } from '../../../../../core/services/roles.api';
import { UsuariosApi } from '../../../../../core/services/usuarios.api';
import { EmptyState } from '../../../../../shared/ui/empty-state/empty-state';
import { Icon } from '../../../../../shared/ui/icon/icon';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { formatearLogin } from '../../../../../shared/util/formato';

/** Asignación de roles a un usuario. Emite `cerrar(true)` si hubo cambios. */
@Component({
  selector: 'app-roles-usuario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal, Icon, EmptyState],
  template: `
    <ui-modal [abierto]="!!usuario()" titulo="Roles del usuario" [subtitulo]="login()" (cerrar)="cerrarModal()">
      <p class="modal-hint">
        Activa los roles de este usuario. Recibe los permisos de sus roles activos; los cambios se aplican al instante.
      </p>
      @if (cargando()) {
        <div class="loading" role="status"><span class="ui-spinner" aria-hidden="true"></span> Cargando roles…</div>
      } @else if (catalogo().length === 0) {
        <ui-empty icono="roles" titulo="Sin roles" mensaje="No hay roles creados en el sistema." />
      } @else {
        <ul class="role-list">
          @for (rol of catalogo(); track rol.id) {
            <li class="role-item">
              <span class="role-item__icon" aria-hidden="true"><ui-icon name="shieldCheck" [size]="18" /></span>
              <span class="role-item__text">
                <span class="role-item__name">
                  {{ rol.nombre }}
                  @if (!rol.activo) {
                    <span class="ui-badge ui-badge--neutral">Inactivo · no concede permisos</span>
                  }
                </span>
                <span class="role-item__desc" [id]="'ru-desc-' + rol.id">{{ rol.descripcion || 'Sin descripción' }}</span>
              </span>
              <button
                type="button"
                role="switch"
                class="switch"
                [class.switch--on]="asignado(rol.id)"
                [attr.aria-checked]="asignado(rol.id)"
                [attr.aria-label]="'Asignar rol ' + rol.nombre"
                [attr.aria-describedby]="'ru-desc-' + rol.id"
                [attr.aria-busy]="cambiando() === rol.id || null"
                [attr.aria-disabled]="cambiando() === rol.id || null"
                (click)="alternar(rol)"
              >
                <span class="switch__thumb" aria-hidden="true"></span>
              </button>
            </li>
          }
        </ul>
      }
      <div modal-footer class="modal-foot">
        <button type="button" class="ui-btn ui-btn--primary" (click)="cerrarModal()">Cerrar</button>
      </div>
    </ui-modal>
  `,
})
export class RolesUsuario {
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly rolesApi = inject(RolesApi);
  private readonly notificaciones = inject(Notificaciones);

  readonly usuario = input<Usuario | null>(null);
  readonly cerrar = output<boolean>();

  readonly cargando = signal(false);
  readonly catalogo = signal<Rol[]>([]);
  readonly asignados = signal<Set<number>>(new Set());
  readonly cambiando = signal<number | null>(null);
  private huboCambios = false;

  constructor() {
    effect(() => {
      const usuario = this.usuario();
      if (usuario) {
        untracked(() => this.cargar(usuario));
      }
    });
  }

  login(): string {
    const usuario = this.usuario();
    return usuario ? `${usuario.nombre} ${usuario.apellido} · ${formatearLogin(usuario.usuario)}` : '';
  }

  asignado(rolId: number): boolean {
    return this.asignados().has(rolId);
  }

  cerrarModal(): void {
    this.cerrar.emit(this.huboCambios);
  }

  alternar(rol: Rol): void {
    const usuario = this.usuario();
    if (!usuario || this.cambiando() !== null) {
      return;
    }
    this.cambiando.set(rol.id);
    const asignado = this.asignado(rol.id);
    const peticion$ = asignado
      ? this.usuariosApi.quitarRol(usuario.id, rol.id)
      : this.usuariosApi.asignarRol(usuario.id, rol.id);

    peticion$.pipe(finalize(() => this.cambiando.set(null))).subscribe({
      next: () => {
        this.huboCambios = true;
        this.asignados.update((actuales) => {
          const copia = new Set(actuales);
          if (asignado) {
            copia.delete(rol.id);
          } else {
            copia.add(rol.id);
          }
          return copia;
        });
        this.notificaciones.info(asignado ? 'Rol revocado' : 'Rol asignado', `${rol.nombre} · ${formatearLogin(usuario.usuario)}`);
      },
      error: (err: unknown) => this.notificaciones.errorHttp('No se pudo actualizar el rol', err),
    });
  }

  private cargar(usuario: Usuario): void {
    this.huboCambios = false;
    this.cargando.set(true);
    forkJoin({ catalogo: this.rolesApi.listar(), asignados: this.usuariosApi.roles(usuario.id) })
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: ({ catalogo, asignados }) => {
          this.catalogo.set(catalogo);
          this.asignados.set(new Set(asignados.map((rol) => rol.id)));
        },
        error: (err: unknown) => this.notificaciones.errorHttp('No se pudieron cargar los roles', err),
      });
  }
}
