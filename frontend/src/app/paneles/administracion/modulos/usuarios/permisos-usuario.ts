import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Observable, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { Permiso, PermisoEfectivo, PermisoFinal, Usuario } from '../../../../core/models';
import { Notificaciones } from '../../../../core/services/notificaciones';
import { PermisosApi } from '../../../../core/services/permisos.api';
import { RolesApi } from '../../../../core/services/roles.api';
import { UsuariosApi } from '../../../../core/services/usuarios.api';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { Icon } from '../../../../shared/ui/icon/icon';
import { Modal } from '../../../../shared/ui/modal/modal';
import { formatearLogin } from '../../../../shared/util/formato';
import { Button } from '../../../../shared/ui/button/button';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Notice } from '../../../../shared/ui/notice/notice';
import { SearchField } from '../../../../shared/ui/search-field/search-field';
import { Segmented } from '../../../../shared/ui/segmented/segmented';

type Ajuste = 'heredar' | 'conceder' | 'denegar';
type Filtro = 'todos' | 'permitidos' | 'bloqueados' | 'ajustes';

interface FilaPermiso {
  permiso: Permiso;
  permitido: boolean;
  ajuste: Ajuste;
  porque: string;
}

interface Resolucion {
  finales: PermisoFinal[];
  /** permisoId → roles que lo conceden. */
  rolesPorPermiso: Map<number, string[]>;
}

/**
 * Permisos individuales (overrides) de un usuario. El resultado de cada fila
 * sale de /finales (fuente de verdad, deny-wins); /efectivos solo explica el
 * porqué (rol de origen). Emite `cerrar(true)` si hubo cambios.
 */
@Component({
  selector: 'app-permisos-usuario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal, Icon, EmptyState, Button, Badge, Notice, SearchField, Segmented],
  templateUrl: './permisos-usuario.html',
})
export class PermisosUsuario {
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly permisosApi = inject(PermisosApi);
  private readonly rolesApi = inject(RolesApi);
  private readonly notificaciones = inject(Notificaciones);

  readonly usuario = input<Usuario | null>(null);
  /** Motivo por el que no se pueden editar los ajustes (sin permiso, cuenta protegida…); null = editable. */
  readonly bloqueo = input<string | null>(null);
  readonly cerrar = output<boolean>();

  readonly cargando = signal(false);
  readonly error = signal(false);
  readonly catalogo = signal<Permiso[]>([]);
  readonly overrides = signal<Map<number, boolean>>(new Map());
  readonly resolucion = signal<Resolucion>({ finales: [], rolesPorPermiso: new Map() });
  readonly cambiando = signal<number | null>(null);
  readonly busqueda = signal('');
  readonly filtro = signal<Filtro>('todos');
  private huboCambios = false;

  readonly filas = computed<FilaPermiso[]>(() => {
    const permitidos = new Set(
      this.resolucion().finales.filter((fila) => fila.permitido).map((fila) => fila.permisoId),
    );
    const roles = this.resolucion().rolesPorPermiso;
    const overrides = this.overrides();
    return this.catalogo().map((permiso) => {
      const override = overrides.get(permiso.id);
      const ajuste: Ajuste = override === true ? 'conceder' : override === false ? 'denegar' : 'heredar';
      const permitido = permitidos.has(permiso.id);
      return { permiso, permitido, ajuste, porque: this.explicar(permiso, permitido, ajuste, roles.get(permiso.id) ?? []) };
    });
  });

  readonly visibles = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const filtro = this.filtro();
    return this.filas().filter(
      (fila) =>
        (!termino ||
          [fila.permiso.nombre, fila.permiso.descripcion ?? ''].some((campo) => campo.toLowerCase().includes(termino))) &&
        (filtro === 'todos' ||
          (filtro === 'permitidos' && fila.permitido) ||
          (filtro === 'bloqueados' && !fila.permitido) ||
          (filtro === 'ajustes' && fila.ajuste !== 'heredar')),
    );
  });

  readonly totalPermitidos = computed(() => this.filas().filter((fila) => fila.permitido).length);
  readonly totalConcedidos = computed(() => [...this.overrides().values()].filter(Boolean).length);
  readonly totalDenegados = computed(() => [...this.overrides().values()].filter((valor) => !valor).length);

  readonly ajustes: { id: Ajuste; etiqueta: string; clase: string }[] = [
    { id: 'heredar', etiqueta: 'Heredar', clase: 'inherit' },
    { id: 'conceder', etiqueta: 'Conceder', clase: 'grant' },
    { id: 'denegar', etiqueta: 'Denegar', clase: 'deny' },
  ];

  readonly opcionesFiltro = computed(() => this.filtros.map((f) => ({ value: f.id, label: f.etiqueta })));

  readonly filtros: { id: Filtro; etiqueta: string }[] = [
    { id: 'todos', etiqueta: 'Todos' },
    { id: 'permitidos', etiqueta: 'Permitidos' },
    { id: 'bloqueados', etiqueta: 'Bloqueados' },
    { id: 'ajustes', etiqueta: 'Con ajuste individual' },
  ];

  constructor() {
    effect(() => {
      const usuario = this.usuario();
      if (usuario) {
        untracked(() => this.cargar(usuario));
      }
    });
  }

  subtitulo(): string {
    const usuario = this.usuario();
    return usuario ? `${usuario.nombre} ${usuario.apellido} · ${formatearLogin(usuario.usuario)}` : '';
  }

  cerrarModal(): void {
    this.cerrar.emit(this.huboCambios);
  }

  aplicar(fila: FilaPermiso, ajuste: Ajuste): void {
    const usuario = this.usuario();
    if (!usuario || this.bloqueo() || this.cambiando() !== null || fila.ajuste === ajuste) {
      return;
    }
    this.cambiando.set(fila.permiso.id);
    const peticion$: Observable<unknown> =
      ajuste === 'heredar'
        ? this.usuariosApi.quitarPermiso(usuario.id, fila.permiso.id)
        : this.usuariosApi.otorgarPermiso(usuario.id, { permisoId: fila.permiso.id, otorgado: ajuste === 'conceder' });

    peticion$
      .pipe(
        switchMap(() => this.resolver(usuario)),
        finalize(() => this.cambiando.set(null)),
      )
      .subscribe({
        next: (resolucion) => {
          this.huboCambios = true;
          this.overrides.update((mapa) => {
            const copia = new Map(mapa);
            if (ajuste === 'heredar') {
              copia.delete(fila.permiso.id);
            } else {
              copia.set(fila.permiso.id, ajuste === 'conceder');
            }
            return copia;
          });
          this.resolucion.set(resolucion);
          const titulo = { heredar: 'Ajuste eliminado: hereda de sus roles', conceder: 'Permiso concedido', denegar: 'Permiso denegado' }[ajuste];
          this.notificaciones.info(titulo, fila.permiso.descripcion || fila.permiso.nombre);
        },
        error: (err: unknown) => this.notificaciones.errorHttp('No se pudo actualizar el permiso', err),
      });
  }

  cargar(usuario: Usuario = this.usuario()!): void {
    this.huboCambios = false;
    this.busqueda.set('');
    this.filtro.set('todos');
    this.error.set(false);
    this.cargando.set(true);
    forkJoin({
      catalogo: this.permisosApi.listar(),
      overrides: this.usuariosApi.permisos(usuario.id),
      resolucion: this.resolver(usuario),
    })
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: ({ catalogo, overrides, resolucion }) => {
          this.catalogo.set(catalogo);
          this.overrides.set(new Map(overrides.map((item) => [item.permisoId, item.otorgado])));
          this.resolucion.set(resolucion);
        },
        error: (err: unknown) => {
          this.error.set(true);
          this.notificaciones.errorHttp('No se pudieron cargar los permisos', err);
        },
      });
  }

  /** Estado final (/finales) y roles de origen de cada permiso concedido por rol. */
  private resolver(usuario: Usuario): Observable<Resolucion> {
    return forkJoin({
      finales: this.usuariosApi.resolucionFinales(usuario.id),
      efectivos: this.usuariosApi.resolucionEfectivos(usuario.id),
    }).pipe(
      switchMap(({ finales, efectivos }) =>
        this.rolesDeOrigen(usuario, efectivos).pipe(map((rolesPorPermiso) => ({ finales, rolesPorPermiso }))),
      ),
    );
  }

  /**
   * Usa `roles` de /efectivos; si el backend aún no lo envía, lo deduce
   * cruzando los roles activos del usuario con los permisos de cada rol.
   */
  private rolesDeOrigen(usuario: Usuario, efectivos: PermisoEfectivo[]): Observable<Map<number, string[]>> {
    const deRol = efectivos.filter((fila) => fila.origen === 'ROL' && fila.otorgado);
    if (deRol.every((fila) => Array.isArray(fila.roles))) {
      return of(new Map(deRol.map((fila) => [fila.permisoId, fila.roles ?? []])));
    }
    return this.usuariosApi.roles(usuario.id).pipe(
      switchMap((roles) => {
        const activos = roles.filter((rol) => rol.activo);
        if (activos.length === 0) {
          return of(new Map<number, string[]>());
        }
        return forkJoin(activos.map((rol) => this.rolesApi.permisos(rol.id).pipe(map((permisos) => ({ rol, permisos }))))).pipe(
          map((pares) => {
            const mapa = new Map<number, string[]>();
            for (const { rol, permisos } of pares) {
              for (const permiso of permisos) {
                mapa.set(permiso.id, [...(mapa.get(permiso.id) ?? []), rol.nombre]);
              }
            }
            return mapa;
          }),
        );
      }),
    );
  }

  private explicar(permiso: Permiso, permitido: boolean, ajuste: Ajuste, roles: string[]): string {
    if (ajuste === 'denegar') {
      return 'Bloqueado: denegado explícitamente a este usuario (la denegación prevalece sobre cualquier rol).';
    }
    if (!permiso.activo) {
      return 'Sin efecto: el permiso está inactivo.';
    }
    if (permitido && roles.length) {
      const extra = ajuste === 'conceder' ? ' y además concedido individualmente' : '';
      return `Permitido: concedido por ${roles.length === 1 ? 'el rol' : 'los roles'} ${roles.join(', ')}${extra}.`;
    }
    if (permitido && ajuste === 'conceder') {
      return 'Permitido: concedido individualmente (ningún rol lo otorga).';
    }
    if (permitido) {
      return 'Permitido.';
    }
    return 'Sin acceso: ningún rol activo lo concede.';
  }
}
