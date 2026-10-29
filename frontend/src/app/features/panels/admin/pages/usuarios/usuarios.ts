import { Component, computed, effect, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, concatMap, finalize, from, of, toArray } from 'rxjs';
import { PERMISOS } from '../../../../../core/config/permisos';
import { MOTIVO_PROTECCION, proteccionUsuario } from '../../../../../core/config/protecciones';
import { mensajeDeError } from '../../../../../core/errors/error.util';
import { Rol, Usuario, UsuarioResumen } from '../../../../../core/models';
import { Anunciador } from '../../../../../core/services/anunciador';
import { DirectorioUsuarios } from '../../../../../core/services/directorio-usuarios';
import { Notificaciones } from '../../../../../core/services/notificaciones';
import { RolesApi } from '../../../../../core/services/roles.api';
import { SesionStore } from '../../../../../core/services/sesion';
import { UsuariosApi } from '../../../../../core/services/usuarios.api';
import { HasPermiso } from '../../../../../shared/directives/has-permiso.directive';
import { ColumnasRedimensionables } from '../../../../../shared/directives/columnas-redimensionables.directive';
import { aplicarErroresServidor, enfocarPrimerInvalido, errorServidor } from '../../../../../shared/forms/errores-formulario';
import { coinciden, contrasenaSegura } from '../../../../../shared/forms/validadores';
import { ActorLabelPipe } from '../../../../../shared/pipes/actor-label.pipe';
import { FechaHoraPipe } from '../../../../../shared/pipes/fecha-hora.pipe';
import { Confirmacion } from '../../../../../shared/ui/confirmacion/confirmacion';
import { EmptyState } from '../../../../../shared/ui/empty-state/empty-state';
import { Historial } from '../../../../../shared/ui/historial/historial';
import { Icon } from '../../../../../shared/ui/icon/icon';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Paginador } from '../../../../../shared/ui/paginador/paginador';
import { RequisitosContrasena } from '../../../../../shared/ui/requisitos/requisitos-contrasena';
import { banderaUrl, crearEstadoUrl, numeroUrl, opcionUrl, paginar, textoUrl } from '../../../../../shared/util/estado-url';
import { formatearLogin, iniciales } from '../../../../../shared/util/formato';
import { PermisosUsuario } from './permisos-usuario';
import { RestablecerContrasena } from './restablecer-contrasena';
import { RolesUsuario } from './roles-usuario';

type Estado = '' | 'activos' | 'inactivos';
type Pestana = 'resumen' | 'accesos' | 'historial';
type Campo = 'usuario' | 'contrasena' | 'confirmacion' | 'nombre' | 'apellido' | 'email' | 'telefono';

@Component({
  selector: 'app-admin-usuarios',
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
    RequisitosContrasena,
    RolesUsuario,
    PermisosUsuario,
    RestablecerContrasena,
  ],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
})
export class Usuarios {
  private readonly fb = inject(FormBuilder);
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly rolesApi = inject(RolesApi);
  private readonly notificaciones = inject(Notificaciones);
  private readonly anunciador = inject(Anunciador);
  private readonly sesion = inject(SesionStore);
  private readonly directorio = inject(DirectorioUsuarios);
  private readonly estadoUrl = crearEstadoUrl();

  readonly permisos = PERMISOS;
  readonly formatearLogin = formatearLogin;
  readonly iniciales = (usuario: Usuario): string => iniciales(usuario.nombre, usuario.apellido);

  // Estado en la URL: ?q=&estado=&rol=&sinRol=1&pagina=&tamano=&usuario=<id del detalle>
  readonly q = input('', { transform: textoUrl });
  readonly estado = input<Estado, unknown>('', { transform: opcionUrl<Estado>(['', 'activos', 'inactivos'], '') });
  readonly rol = input('', { transform: textoUrl });
  readonly sinRol = input(false, { transform: banderaUrl });
  readonly pagina = input(1, { transform: numeroUrl(1) });
  readonly tamano = input(10, { transform: numeroUrl(10) });
  readonly usuario = input(0, { transform: numeroUrl(0) });
  readonly textoBusqueda = linkedSignal(() => this.q());

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly usuarios = signal<Usuario[]>([]);

  /** El resumen (roles y permisos efectivos) exige ver usuarios, roles y permisos. */
  readonly puedeResumen = computed(() =>
    this.sesion.tieneTodos([PERMISOS.VER_USUARIOS, PERMISOS.VER_ROLES, PERMISOS.VER_PERMISOS]),
  );
  readonly puedeAsignarRoles = computed(() => this.sesion.tieneTodos([PERMISOS.ASIGNAR_ROLES, PERMISOS.VER_ROLES]));
  readonly cargandoResumen = signal(false);
  readonly resumen = signal<Map<number, UsuarioResumen>>(new Map());
  /** Clave de la última consulta de resumen ('*' = todos; si no, ids de la página). */
  private ultimaConsultaResumen = '';
  readonly idSesion = computed(() => this.sesion.usuario()?.id ?? null);

  /** Nombres de rol del catálogo, para el filtro por rol. */
  readonly rolesDisponibles = signal<string[]>([]);

  readonly filtrados = computed(() => {
    const termino = this.q().trim().toLowerCase();
    const estado = this.estado();
    const rol = this.rol();
    const sinRol = this.sinRol();
    const resumen = this.resumen();
    return this.usuarios().filter((usuario) => {
      const roles = resumen.get(usuario.id)?.roles;
      return (
        (!termino ||
          [usuario.usuario, usuario.nombre, usuario.apellido, usuario.email]
            .filter(Boolean)
            .some((campo) => campo.toLowerCase().includes(termino))) &&
        (estado === '' || usuario.activo === (estado === 'activos')) &&
        (!rol || !!roles?.includes(rol)) &&
        (!sinRol || (roles !== undefined && roles.length === 0))
      );
    });
  });

  private readonly paginacion = computed(() => paginar(this.filtrados(), this.pagina(), this.tamano()));
  readonly paginados = computed(() => this.paginacion().items);
  readonly paginaActual = computed(() => this.paginacion().pagina);
  readonly hayFiltros = computed(() => !!this.q() || !!this.estado() || !!this.rol() || this.sinRol());

  /**
   * Usuarios cuyo resumen se necesita: la página visible (GET /usuarios/resumen?ids=…)
   * o todos (null) cuando se filtra por rol o "sin rol".
   */
  private readonly idsResumen = computed<number[] | null>(() =>
    this.rol() || this.sinRol() ? null : this.paginados().map((usuario) => usuario.id),
  );

  // --- Detalle (panel lateral) ---
  readonly detalle = computed(() => this.usuarios().find((usuario) => usuario.id === this.usuario()) ?? null);
  readonly pestana = signal<Pestana>('resumen');

  // --- Formulario de alta / edición ---
  readonly formAbierto = signal(false);
  readonly editando = signal<Usuario | null>(null);
  readonly guardando = signal(false);
  readonly catalogoRoles = signal<Rol[]>([]);
  readonly rolesIniciales = signal<Set<number>>(new Set());
  readonly verContrasena = signal(false);

  readonly formulario = this.fb.nonNullable.group(
    {
      usuario: ['', [Validators.required, Validators.maxLength(50)]],
      contrasena: [''],
      confirmacion: [''],
      nombre: ['', [Validators.required, Validators.maxLength(100)]],
      apellido: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
      telefono: ['', [Validators.maxLength(20)]],
      activo: [true],
    },
    { validators: coinciden('contrasena', 'confirmacion') },
  );
  readonly valorContrasena = toSignal(this.formulario.controls.contrasena.valueChanges, { initialValue: '' });

  // --- Acciones con confirmación y modales secundarios ---
  readonly aEliminar = signal<Usuario | null>(null);
  readonly eliminando = signal(false);
  readonly aDesactivar = signal<Usuario | null>(null);
  readonly cambiandoEstado = signal(false);
  readonly rolesDe = signal<Usuario | null>(null);
  readonly permisosDe = signal<Usuario | null>(null);
  readonly restablecerDe = signal<Usuario | null>(null);

  constructor() {
    this.cargar();
    effect(() => {
      const ids = this.idsResumen();
      untracked(() => this.cargarResumen(ids));
    });
    if (this.puedeResumen()) {
      this.rolesApi.listar().pipe(catchError(() => of([] as Rol[]))).subscribe((roles) =>
        this.rolesDisponibles.set(roles.map((rol) => rol.nombre).sort((a, b) => a.localeCompare(b))),
      );
    }
    // Al abrir otro detalle se vuelve a la pestaña Resumen y, si el usuario no
    // está en la página visible (enlace directo), se pide su resumen.
    effect(() => {
      const id = this.usuario();
      untracked(() => {
        this.pestana.set('resumen');
        if (id && this.puedeResumen() && !this.resumen().has(id)) {
          this.usuariosApi.resumen([id]).pipe(catchError(() => of([] as UsuarioResumen[]))).subscribe((filas) =>
            this.resumen.update((actual) => new Map([...actual, ...filas.map((fila) => [fila.usuarioId, fila] as const)])),
          );
        }
      });
    });
  }

  cargar(): void {
    if (this.cargando() && this.usuarios().length) {
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    this.usuariosApi
      .listar()
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (lista) => {
          // Lista nueva: el resumen se vuelve a pedir aunque la página sea la misma.
          this.ultimaConsultaResumen = '';
          this.usuarios.set(lista);
          this.directorio.establecer(lista);
          this.anunciador.anunciar(`${this.filtrados().length} usuarios`);
        },
        error: (err: unknown) => this.error.set(mensajeDeError(err)),
      });
  }

  /**
   * Una sola petición en lugar de 2 por usuario. Sin argumentos refresca la
   * consulta vigente (p. ej. tras cambiar roles o ajustes).
   */
  cargarResumen(ids: number[] | null = this.idsResumen(), forzar = false): void {
    const clave = ids === null ? '*' : ids.join(',');
    if (!this.puedeResumen() || (ids !== null && ids.length === 0) || (!forzar && clave === this.ultimaConsultaResumen)) {
      return;
    }
    this.ultimaConsultaResumen = clave;
    this.cargandoResumen.set(true);
    this.usuariosApi
      .resumen(ids ?? undefined)
      .pipe(finalize(() => this.cargandoResumen.set(false)))
      .subscribe({
        next: (filas) =>
          this.resumen.update((actual) => {
            const mapa = ids === null ? new Map<number, UsuarioResumen>() : new Map(actual);
            filas.forEach((fila) => mapa.set(fila.usuarioId, fila));
            return mapa;
          }),
        error: () => (this.ultimaConsultaResumen = ''),
      });
  }

  resumenDe(id: number): UsuarioResumen | null {
    return this.resumen().get(id) ?? null;
  }

  // --- Filtros en la URL ---
  buscar(valor: string): void {
    this.textoBusqueda.set(valor);
    this.estadoUrl.fijar({ q: valor.trim(), pagina: null }, true);
  }

  filtrar(cambios: { estado?: Estado; rol?: string; sinRol?: boolean }): void {
    this.estadoUrl.fijar({ ...cambios, pagina: null });
  }

  limpiarFiltros(): void {
    this.textoBusqueda.set('');
    this.estadoUrl.fijar({ q: null, estado: null, rol: null, sinRol: null, pagina: null });
  }

  irAPagina(pagina: number): void {
    this.estadoUrl.fijar({ pagina: pagina > 1 ? pagina : null });
  }

  cambiarTamano(tamano: number): void {
    this.estadoUrl.fijar({ tamano: tamano !== 10 ? tamano : null, pagina: null });
  }

  abrirDetalle(usuario: Usuario): void {
    this.estadoUrl.fijar({ usuario: usuario.id });
  }

  cerrarDetalle(): void {
    this.estadoUrl.fijar({ usuario: null });
  }

  // --- Protecciones ---
  proteccion(usuario: Usuario): 'sistema' | 'propio' | null {
    return proteccionUsuario(usuario, this.idSesion());
  }

  /** Motivo por el que no se pueden gestionar accesos/estado del usuario (null = permitido). */
  bloqueoAccesos(usuario: Usuario): string | null {
    const proteccion = this.proteccion(usuario);
    return proteccion === 'sistema' ? MOTIVO_PROTECCION.usuario : proteccion === 'propio' ? MOTIVO_PROTECCION.propio : null;
  }

  bloqueoEdicion(usuario: Usuario): string | null {
    return this.proteccion(usuario) === 'sistema' ? MOTIVO_PROTECCION.usuario : null;
  }

  bloqueoOverrides(usuario: Usuario): string | null {
    return this.sesion.tienePermiso(PERMISOS.ASIGNAR_PERMISOS)
      ? this.bloqueoAccesos(usuario)
      : 'No tienes permiso para modificar ajustes individuales.';
  }

  // --- Alta / edición ---
  campoInvalido(campo: Campo): boolean {
    const control = this.formulario.controls[campo];
    return control.touched && control.invalid;
  }

  errorServidor(campo: string): string | null {
    return errorServidor(this.formulario, campo);
  }

  abrirCrear(): void {
    this.editando.set(null);
    this.rolesIniciales.set(new Set());
    this.verContrasena.set(false);
    this.formulario.reset();
    this.ajustarContrasena(true);
    this.formAbierto.set(true);
    if (this.puedeAsignarRoles()) {
      this.rolesApi.listar().pipe(catchError(() => of([] as Rol[]))).subscribe((roles) =>
        this.catalogoRoles.set(roles.filter((rol) => rol.activo)),
      );
    }
  }

  abrirEditar(usuario: Usuario): void {
    if (this.bloqueoEdicion(usuario)) {
      return;
    }
    this.editando.set(usuario);
    this.formulario.reset({
      usuario: usuario.usuario,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      telefono: usuario.telefono ?? '',
      activo: usuario.activo,
    });
    this.ajustarContrasena(false);
    this.formAbierto.set(true);
  }

  private ajustarContrasena(requerida: boolean): void {
    const { contrasena, confirmacion } = this.formulario.controls;
    contrasena.setValidators(requerida ? [Validators.required, contrasenaSegura] : []);
    confirmacion.setValidators(requerida ? [Validators.required] : []);
    contrasena.updateValueAndValidity();
    confirmacion.updateValueAndValidity();
  }

  alternarRolInicial(rolId: number): void {
    this.rolesIniciales.update((actuales) => {
      const copia = new Set(actuales);
      if (copia.has(rolId)) {
        copia.delete(rolId);
      } else {
        copia.add(rolId);
      }
      return copia;
    });
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
    const datos = {
      usuario: valores.usuario.trim(),
      nombre: valores.nombre.trim(),
      apellido: valores.apellido.trim(),
      email: valores.email.trim(),
      telefono: valores.telefono.trim() || null,
      activo: valores.activo,
    };
    this.guardando.set(true);
    const peticion$ = editando
      ? this.usuariosApi.actualizar(editando.id, datos)
      : this.usuariosApi.crear({ ...datos, contrasena: valores.contrasena });

    peticion$.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (usuario) => {
        this.usuarios.update((lista) =>
          editando ? lista.map((item) => (item.id === usuario.id ? usuario : item)) : [usuario, ...lista],
        );
        this.cerrarForm();
        if (editando) {
          this.notificaciones.exito('Usuario actualizado', formatearLogin(usuario.usuario));
        } else {
          this.trasCrear(usuario);
        }
      },
      error: (err: unknown) => {
        const enCampo = aplicarErroresServidor(this.formulario, err, (mensaje) =>
          /correo|email/i.test(mensaje)
            ? { campo: 'email', mensaje: 'Ya existe un usuario con ese correo electrónico.' }
            : { campo: 'usuario', mensaje: 'Ya existe un usuario con ese nombre de usuario.' },
        );
        if (!enCampo) {
          this.notificaciones.errorHttp('No se pudo guardar el usuario', err);
        }
      },
    });
  }

  /** Tras el alta asigna los roles elegidos; sin roles, guía al administrador a asignarlos. */
  private trasCrear(usuario: Usuario): void {
    const login = formatearLogin(usuario.usuario);
    const roles = [...this.rolesIniciales()];
    if (roles.length === 0) {
      this.cargarResumen(this.idsResumen(), true);
      this.notificaciones.exito(
        'Usuario creado',
        `${login} aún no tiene roles, así que no tiene acceso.`,
        this.puedeAsignarRoles() ? { accion: { etiqueta: 'Asignar roles', ejecutar: () => this.rolesDe.set(usuario) } } : undefined,
      );
      return;
    }
    from(roles)
      .pipe(
        concatMap((rolId) => this.usuariosApi.asignarRol(usuario.id, rolId).pipe(catchError(() => of(null)))),
        toArray(),
      )
      .subscribe((resultados) => {
        const fallidos = resultados.filter((resultado) => resultado === null).length;
        this.cargarResumen(this.idsResumen(), true);
        if (fallidos) {
          this.notificaciones.advertencia('Usuario creado con avisos', `${login}: no se pudieron asignar ${fallidos} de ${roles.length} roles.`);
        } else {
          this.notificaciones.exito('Usuario creado', `${login} con ${roles.length} ${roles.length === 1 ? 'rol' : 'roles'}.`);
        }
      });
  }

  // --- Estado ---
  alternarActivo(usuario: Usuario): void {
    if (this.bloqueoAccesos(usuario)) {
      return;
    }
    if (usuario.activo) {
      this.aDesactivar.set(usuario);
    } else {
      this.cambiarEstado(usuario, true);
    }
  }

  confirmarDesactivar(motivo: string): void {
    const usuario = this.aDesactivar();
    if (usuario) {
      this.cambiarEstado(usuario, false, motivo);
    }
  }

  private cambiarEstado(usuario: Usuario, activo: boolean, motivo?: string): void {
    if (this.cambiandoEstado()) {
      return;
    }
    this.cambiandoEstado.set(true);
    this.usuariosApi
      .cambiarActivo(usuario.id, activo, motivo)
      .pipe(finalize(() => this.cambiandoEstado.set(false)))
      .subscribe({
        next: (actualizado) => {
          this.usuarios.update((lista) => lista.map((item) => (item.id === actualizado.id ? actualizado : item)));
          this.aDesactivar.set(null);
          this.notificaciones.info(activo ? 'Usuario activado' : 'Usuario desactivado', formatearLogin(actualizado.usuario));
        },
        error: (err: unknown) => this.notificaciones.errorHttp('No se pudo cambiar el estado', err),
      });
  }

  // --- Eliminación ---
  confirmarEliminar(usuario: Usuario): void {
    if (!this.bloqueoAccesos(usuario)) {
      this.aEliminar.set(usuario);
    }
  }

  eliminar(): void {
    const usuario = this.aEliminar();
    if (!usuario || this.eliminando()) {
      return;
    }
    this.eliminando.set(true);
    this.usuariosApi
      .eliminar(usuario.id)
      .pipe(finalize(() => this.eliminando.set(false)))
      .subscribe({
        next: () => {
          this.usuarios.update((lista) => lista.filter((item) => item.id !== usuario.id));
          this.notificaciones.exito('Usuario eliminado', formatearLogin(usuario.usuario));
          this.aEliminar.set(null);
          if (this.usuario() === usuario.id) {
            this.cerrarDetalle();
          }
        },
        error: (err: unknown) => this.notificaciones.errorHttp('No se pudo eliminar el usuario', err),
      });
  }

  // --- Accesos (roles y ajustes individuales) ---
  abrirRoles(usuario: Usuario): void {
    if (!this.bloqueoAccesos(usuario)) {
      this.rolesDe.set(usuario);
    }
  }

  abrirPermisos(usuario: Usuario): void {
    this.permisosDe.set(usuario);
  }

  abrirRestablecer(usuario: Usuario): void {
    if (!this.bloqueoAccesos(usuario)) {
      this.restablecerDe.set(usuario);
    }
  }

  /** Al cerrar los modales de accesos se refrescan las columnas Roles/Permisos. */
  alCerrarAccesos(huboCambios: boolean): void {
    this.rolesDe.set(null);
    this.permisosDe.set(null);
    if (huboCambios) {
      this.cargarResumen(this.idsResumen(), true);
    }
  }
}
