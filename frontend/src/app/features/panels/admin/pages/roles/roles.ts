import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { CONFIG } from '../../../../../core/config/configuracion';
import { PERMISOS } from '../../../../../core/config/permisos';
import { MOTIVO_PROTECCION, rolProtegido } from '../../../../../core/config/protecciones';
import { mensajeDeError } from '../../../../../core/errors/error.util';
import { Permiso, Rol } from '../../../../../core/models';
import { AnaliticaApi } from '../../../../../core/services/analitica.api';
import { Anunciador } from '../../../../../core/services/anunciador';
import { DirectorioUsuarios } from '../../../../../core/services/directorio-usuarios';
import { Notificaciones } from '../../../../../core/services/notificaciones';
import { PermisosApi } from '../../../../../core/services/permisos.api';
import { RolesApi } from '../../../../../core/services/roles.api';
import { SesionStore } from '../../../../../core/services/sesion';
import { HasPermiso } from '../../../../../shared/directives/has-permiso.directive';
import { ColumnasRedimensionables } from '../../../../../shared/directives/columnas-redimensionables.directive';
import { aplicarErroresServidor, enfocarPrimerInvalido, errorServidor } from '../../../../../shared/forms/errores-formulario';
import { ActorLabelPipe } from '../../../../../shared/pipes/actor-label.pipe';
import { FechaHoraPipe } from '../../../../../shared/pipes/fecha-hora.pipe';
import { Confirmacion } from '../../../../../shared/ui/confirmacion/confirmacion';
import { EmptyState } from '../../../../../shared/ui/empty-state/empty-state';
import { Historial } from '../../../../../shared/ui/historial/historial';
import { Icon } from '../../../../../shared/ui/icon/icon';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Paginador } from '../../../../../shared/ui/paginador/paginador';
import { crearEstadoUrl, numeroUrl, opcionUrl, paginar, textoUrl } from '../../../../../shared/util/estado-url';

type Estado = '' | 'activos' | 'inactivos';

interface ImpactoRol {
  usuarios: number | null;
  permisos: number | null;
}

@Component({
  selector: 'app-admin-roles',
  imports: [
    ReactiveFormsModule,
    ActorLabelPipe,
    FechaHoraPipe,
    Icon,
    Modal,
    Confirmacion,
    EmptyState,
    Historial,
    HasPermiso,
    ColumnasRedimensionables,
    Paginador,
  ],
  templateUrl: './roles.html',
  styleUrl: './roles.scss',
})
export class Roles {
  private readonly fb = inject(FormBuilder);
  private readonly rolesApi = inject(RolesApi);
  private readonly permisosApi = inject(PermisosApi);
  private readonly analiticaApi = inject(AnaliticaApi);
  private readonly notificaciones = inject(Notificaciones);
  private readonly anunciador = inject(Anunciador);
  private readonly directorio = inject(DirectorioUsuarios);
  private readonly sesion = inject(SesionStore);
  private readonly estadoUrl = crearEstadoUrl();

  readonly permisos = PERMISOS;
  readonly motivoProteccion = MOTIVO_PROTECCION.rol;
  readonly protegido = rolProtegido;

  readonly q = input('', { transform: textoUrl });
  readonly estado = input<Estado, unknown>('', { transform: opcionUrl<Estado>(['', 'activos', 'inactivos'], '') });
  readonly pagina = input(1, { transform: numeroUrl(1) });
  readonly tamano = input(10, { transform: numeroUrl(10) });
  readonly textoBusqueda = linkedSignal(() => this.q());

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly roles = signal<Rol[]>([]);
  /** Usuarios por rol (analítica); null si no se dispone del dato. */
  readonly usuariosPorRol = signal<Map<string, number> | null>(null);

  readonly filtrados = computed(() => {
    const termino = this.q().trim().toLowerCase();
    const estado = this.estado();
    return this.roles().filter(
      (rol) =>
        (!termino || [rol.nombre, rol.descripcion ?? ''].some((campo) => campo.toLowerCase().includes(termino))) &&
        (estado === '' || rol.activo === (estado === 'activos')),
    );
  });

  private readonly paginacion = computed(() => paginar(this.filtrados(), this.pagina(), this.tamano()));
  readonly paginados = computed(() => this.paginacion().items);
  readonly paginaActual = computed(() => this.paginacion().pagina);
  readonly hayFiltros = computed(() => !!this.q() || !!this.estado());

  readonly formAbierto = signal(false);
  readonly editando = signal<Rol | null>(null);
  readonly guardando = signal(false);

  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    descripcion: ['', [Validators.maxLength(255)]],
    activo: [true],
  });

  readonly aEliminar = signal<Rol | null>(null);
  readonly eliminando = signal(false);

  readonly aDesactivar = signal<Rol | null>(null);
  readonly impacto = signal<ImpactoRol | null>(null);
  readonly cambiandoEstado = signal(false);

  readonly permisosAbierto = signal(false);
  readonly rolPermisos = signal<Rol | null>(null);
  readonly cargandoPermisos = signal(false);
  readonly catalogoPermisos = signal<Permiso[]>([]);
  readonly permisosAsignados = signal<Set<number>>(new Set());
  readonly cambiandoPermiso = signal<number | null>(null);
  readonly usuariosDelRol = signal<number | null>(null);

  readonly historialDe = signal<Rol | null>(null);

  constructor() {
    this.directorio.cargar();
    this.cargar();
  }

  cargar(): void {
    if (this.cargando() && this.roles().length) {
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    this.rolesApi
      .listar()
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (lista) => {
          this.roles.set(lista);
          this.anunciador.anunciar(`${this.filtrados().length} roles`);
        },
        error: (err: unknown) => this.error.set(mensajeDeError(err)),
      });
    if (this.sesion.tienePermiso(PERMISOS.DASHBOARD_ADMIN)) {
      this.analiticaApi
        .admin()
        .pipe(catchError(() => of(null)))
        .subscribe((analitica) =>
          this.usuariosPorRol.set(
            analitica ? new Map(analitica.usuariosPorRol.map((fila) => [fila.etiqueta, fila.valor])) : null,
          ),
        );
    }
  }

  usuariosDe(rol: Rol): number | null {
    const mapa = this.usuariosPorRol();
    return mapa ? (mapa.get(rol.nombre) ?? 0) : null;
  }

  buscar(valor: string): void {
    this.textoBusqueda.set(valor);
    this.estadoUrl.fijar({ q: valor.trim(), pagina: null }, true);
  }

  filtrarEstado(estado: Estado): void {
    this.estadoUrl.fijar({ estado, pagina: null });
  }

  limpiarFiltros(): void {
    this.textoBusqueda.set('');
    this.estadoUrl.fijar({ q: null, estado: null, pagina: null });
  }

  irAPagina(pagina: number): void {
    this.estadoUrl.fijar({ pagina: pagina > 1 ? pagina : null });
  }

  cambiarTamano(tamano: number): void {
    this.estadoUrl.fijar({ tamano: tamano !== 10 ? tamano : null, pagina: null });
  }

  campoInvalido(campo: 'nombre' | 'descripcion'): boolean {
    const control = this.formulario.controls[campo];
    return control.touched && control.invalid;
  }

  errorServidor(campo: string): string | null {
    return errorServidor(this.formulario, campo);
  }

  abrirCrear(): void {
    this.editando.set(null);
    this.formulario.reset({ nombre: '', descripcion: '', activo: true });
    this.formAbierto.set(true);
  }

  abrirEditar(rol: Rol): void {
    if (this.protegido(rol)) {
      return;
    }
    this.editando.set(rol);
    this.formulario.reset({ nombre: rol.nombre, descripcion: rol.descripcion ?? '', activo: rol.activo });
    this.formAbierto.set(true);
  }

  cerrarForm(): void {
    this.formAbierto.set(false);
    this.editando.set(null);
  }

  guardar(): void {
    if (this.guardando()) {
      return;
    }
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      enfocarPrimerInvalido();
      return;
    }

    const valores = this.formulario.getRawValue();
    const editando = this.editando();
    const peticion = {
      nombre: valores.nombre.trim(),
      descripcion: valores.descripcion.trim() || null,
      activo: valores.activo,
    };

    this.guardando.set(true);
    const peticion$ = editando ? this.rolesApi.actualizar(editando.id, peticion) : this.rolesApi.crear(peticion);

    peticion$.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (rol) => {
        this.roles.update((lista) =>
          editando ? lista.map((item) => (item.id === rol.id ? rol : item)) : [rol, ...lista],
        );
        this.notificaciones.exito(editando ? 'Rol actualizado' : 'Rol creado', rol.nombre);
        this.cerrarForm();
      },
      error: (err: unknown) => {
        const enCampo = aplicarErroresServidor(this.formulario, err, () => ({
          campo: 'nombre',
          mensaje: 'Ya existe un rol con ese nombre.',
        }));
        if (!enCampo) {
          this.notificaciones.errorHttp('No se pudo guardar el rol', err);
        }
      },
    });
  }

  /** Activar es inmediato; desactivar muestra antes a cuántos usuarios afecta. */
  alternarActivo(rol: Rol): void {
    if (this.protegido(rol)) {
      return;
    }
    if (!rol.activo) {
      this.cambiarEstado(rol, true);
      return;
    }
    this.impacto.set(null);
    this.aDesactivar.set(rol);
    forkJoin({
      usuarios: this.sesion.tienePermiso(PERMISOS.VER_USUARIOS)
        ? this.rolesApi.usuarios(rol.id).pipe(catchError(() => of(null)))
        : of(null),
      permisos: this.rolesApi.permisos(rol.id).pipe(catchError(() => of(null))),
    }).subscribe(({ usuarios, permisos }) =>
      this.impacto.set({ usuarios: usuarios?.length ?? null, permisos: permisos?.length ?? null }),
    );
  }

  /** Frase de impacto: "5 usuarios dejarán de recibir sus 12 permisos". */
  readonly textoImpacto = computed(() => {
    const impacto = this.impacto();
    if (!impacto) {
      return 'Calculando a cuántos usuarios afecta…';
    }
    const n = impacto.usuarios;
    const p = impacto.permisos;
    const usuarios = n === null ? 'Sus usuarios dejarán' : n === 1 ? '1 usuario dejará' : `${n} usuarios dejarán`;
    const permisos = p === null ? 'sus permisos' : p === 1 ? 'su único permiso' : `sus ${p} permisos`;
    return `${usuarios} de recibir ${permisos}. Las asignaciones se conservan y podrás reactivarlo. Quedará registrado en la auditoría.`;
  });

  confirmarDesactivar(motivo: string): void {
    const rol = this.aDesactivar();
    if (rol) {
      this.cambiarEstado(rol, false, motivo);
    }
  }

  private cambiarEstado(rol: Rol, activo: boolean, motivo?: string): void {
    if (this.cambiandoEstado()) {
      return;
    }
    this.cambiandoEstado.set(true);
    this.rolesApi
      .cambiarActivo(rol.id, activo, motivo)
      .pipe(finalize(() => this.cambiandoEstado.set(false)))
      .subscribe({
        next: (actualizado) => {
          this.roles.update((lista) => lista.map((item) => (item.id === actualizado.id ? actualizado : item)));
          this.aDesactivar.set(null);
          this.notificaciones.info(activo ? 'Rol activado' : 'Rol desactivado', actualizado.nombre);
        },
        error: (err: unknown) => this.notificaciones.errorHttp('No se pudo cambiar el estado del rol', err),
      });
  }

  confirmarEliminar(rol: Rol): void {
    if (!this.protegido(rol)) {
      this.aEliminar.set(rol);
    }
  }

  eliminar(): void {
    const rol = this.aEliminar();
    if (!rol || this.eliminando()) {
      return;
    }
    this.eliminando.set(true);
    this.rolesApi
      .eliminar(rol.id)
      .pipe(finalize(() => this.eliminando.set(false)))
      .subscribe({
        next: () => {
          this.roles.update((lista) => lista.filter((item) => item.id !== rol.id));
          this.notificaciones.exito('Rol eliminado', rol.nombre);
          this.aEliminar.set(null);
        },
        error: (err: unknown) => this.notificaciones.errorHttp('No se pudo eliminar el rol', err),
      });
  }

  abrirPermisos(rol: Rol): void {
    this.rolPermisos.set(rol);
    this.usuariosDelRol.set(null);
    this.permisosAbierto.set(true);
    this.cargandoPermisos.set(true);
    forkJoin({
      catalogo: this.permisosApi.listar(),
      asignados: this.rolesApi.permisos(rol.id),
    })
      .pipe(finalize(() => this.cargandoPermisos.set(false)))
      .subscribe({
        next: ({ catalogo, asignados }) => {
          this.catalogoPermisos.set(catalogo);
          this.permisosAsignados.set(new Set(asignados.map((permiso) => permiso.id)));
        },
        error: (err: unknown) => this.notificaciones.errorHttp('No se pudieron cargar los permisos', err),
      });
    if (this.sesion.tienePermiso(PERMISOS.VER_USUARIOS)) {
      this.rolesApi
        .usuarios(rol.id)
        .pipe(catchError(() => of(null)))
        .subscribe((usuarios) => this.usuariosDelRol.set(usuarios?.length ?? null));
    }
  }

  estaAsignado(permisoId: number): boolean {
    return this.permisosAsignados().has(permisoId);
  }

  /** En el rol protegido los permisos solo se pueden agregar, no quitar. */
  bloqueadoQuitar(permisoId: number): boolean {
    const rol = this.rolPermisos();
    return !!rol && this.protegido(rol) && this.estaAsignado(permisoId);
  }

  alternarPermiso(permiso: Permiso, deshaciendo = false): void {
    const rol = this.rolPermisos();
    if (!rol || this.cambiandoPermiso() !== null || this.bloqueadoQuitar(permiso.id)) {
      return;
    }
    this.cambiandoPermiso.set(permiso.id);
    const asignado = this.estaAsignado(permiso.id);
    const peticion$ = asignado
      ? this.rolesApi.quitarPermiso(rol.id, permiso.id)
      : this.rolesApi.asignarPermiso(rol.id, permiso.id);

    peticion$.pipe(finalize(() => this.cambiandoPermiso.set(null))).subscribe({
      next: () => {
        this.permisosAsignados.update((actuales) => {
          const copia = new Set(actuales);
          if (asignado) {
            copia.delete(permiso.id);
          } else {
            copia.add(permiso.id);
          }
          return copia;
        });
        if (asignado && !deshaciendo) {
          // Quitar afecta a todos los usuarios del rol: se ofrece deshacer durante unos segundos.
          this.notificaciones.info('Permiso quitado del rol', `${permiso.nombre} · ${rol.nombre}`, {
            duracion: CONFIG.notificaciones.duracionDeshacer,
            accion: { etiqueta: 'Deshacer', ejecutar: () => this.deshacerQuitar(rol, permiso) },
          });
        } else {
          this.notificaciones.info(asignado ? 'Permiso quitado del rol' : 'Permiso agregado al rol', `${permiso.nombre} · ${rol.nombre}`);
        }
      },
      error: (err: unknown) => this.notificaciones.errorHttp('No se pudo actualizar el rol', err),
    });
  }

  private deshacerQuitar(rol: Rol, permiso: Permiso): void {
    if (this.rolPermisos()?.id === rol.id && this.permisosAbierto()) {
      this.alternarPermiso(permiso, true);
      return;
    }
    this.rolesApi.asignarPermiso(rol.id, permiso.id).subscribe({
      next: () => this.notificaciones.info('Permiso restaurado', `${permiso.nombre} · ${rol.nombre}`),
      error: (err: unknown) => this.notificaciones.errorHttp('No se pudo restaurar el permiso', err),
    });
  }
}
