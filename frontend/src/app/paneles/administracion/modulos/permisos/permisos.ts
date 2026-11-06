import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { PERMISOS } from '../../../../core/config/permisos';
import { MOTIVO_PROTECCION, permisoProtegido } from '../../../../core/config/protecciones';
import { mensajeDeError } from '../../../../core/errors/error.util';
import { Permiso, Rol } from '../../../../core/models';
import { Anunciador } from '../../../../core/services/anunciador';
import { DirectorioUsuarios } from '../../../../core/services/directorio-usuarios';
import { Notificaciones } from '../../../../core/services/notificaciones';
import { PermisosApi } from '../../../../core/services/permisos.api';
import { HasPermiso } from '../../../../shared/directives/has-permiso.directive';
import { ColumnasRedimensionables } from '../../../../shared/directives/columnas-redimensionables.directive';
import { aplicarErroresServidor, enfocarPrimerInvalido, errorServidor } from '../../../../shared/forms/errores-formulario';
import { ActorLabelPipe } from '../../../../shared/pipes/actor-label.pipe';
import { FechaHoraPipe } from '../../../../shared/pipes/fecha-hora.pipe';
import { Confirmacion } from '../../../../shared/ui/confirmacion/confirmacion';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { Icon } from '../../../../shared/ui/icon/icon';
import { PANEL_ACTUAL } from '../../../panel-actual';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Paginador } from '../../../../shared/ui/paginador/paginador';
import { crearEstadoUrl, numeroUrl, opcionUrl, paginar, textoUrl } from '../../../../shared/util/estado-url';

type Estado = '' | 'activos' | 'inactivos';

@Component({
  selector: 'app-permisos',
  imports: [
    ReactiveFormsModule,
    ActorLabelPipe,
    FechaHoraPipe,
    Icon,
    Modal,
    Confirmacion,
    EmptyState,
    HasPermiso,
    ColumnasRedimensionables,
    Paginador,
  ],
  templateUrl: './permisos.html',
  styleUrl: './permisos.scss',
})
export class Permisos {
  /** Panel al que pertenece el módulo (antetítulo de la cabecera). */
  readonly panel = inject(PANEL_ACTUAL);
  private readonly fb = inject(FormBuilder);
  private readonly permisosApi = inject(PermisosApi);
  private readonly notificaciones = inject(Notificaciones);
  private readonly anunciador = inject(Anunciador);
  private readonly directorio = inject(DirectorioUsuarios);
  private readonly estadoUrl = crearEstadoUrl();

  readonly permisos = PERMISOS;
  readonly motivoProteccion = MOTIVO_PROTECCION.permiso;
  readonly protegido = permisoProtegido;

  // Estado en la URL (?q=&estado=&pagina=&tamano=).
  readonly q = input('', { transform: textoUrl });
  readonly estado = input<Estado, unknown>('', { transform: opcionUrl<Estado>(['', 'activos', 'inactivos'], '') });
  readonly pagina = input(1, { transform: numeroUrl(1) });
  readonly tamano = input(10, { transform: numeroUrl(10) });
  readonly textoBusqueda = linkedSignal(() => this.q());

  readonly cargando = signal(true);
  /** Presentación: panel de filtros desplegado (solo se pliega en móvil). */
  readonly filtrosAbiertos = signal(false);
  readonly error = signal<string | null>(null);
  readonly permisosLista = signal<Permiso[]>([]);

  readonly filtrados = computed(() => {
    const termino = this.q().trim().toLowerCase();
    const estado = this.estado();
    return this.permisosLista().filter(
      (permiso) =>
        (!termino ||
          [permiso.nombre, permiso.descripcion ?? ''].some((campo) => campo.toLowerCase().includes(termino))) &&
        (estado === '' || permiso.activo === (estado === 'activos')),
    );
  });

  private readonly paginacion = computed(() => paginar(this.filtrados(), this.pagina(), this.tamano()));
  readonly paginados = computed(() => this.paginacion().items);
  readonly paginaActual = computed(() => this.paginacion().pagina);
  readonly hayFiltros = computed(() => !!this.q() || !!this.estado());

  readonly formAbierto = signal(false);
  readonly editando = signal<Permiso | null>(null);
  readonly guardando = signal(false);

  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    descripcion: ['', [Validators.maxLength(255)]],
    activo: [true],
  });

  readonly aEliminar = signal<Permiso | null>(null);
  readonly eliminando = signal(false);
  readonly aDesactivar = signal<Permiso | null>(null);
  readonly cambiandoEstado = signal(false);

  readonly rolesAbierto = signal(false);
  readonly permisoRoles = signal<Permiso | null>(null);
  readonly cargandoRoles = signal(false);
  readonly rolesConPermiso = signal<Rol[]>([]);

  constructor() {
    this.directorio.cargar();
    this.cargar();
  }

  cargar(): void {
    if (this.cargando() && this.permisosLista().length) {
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    this.permisosApi
      .listar()
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (lista) => {
          this.permisosLista.set(lista);
          this.anunciador.anunciar(`${this.filtrados().length} permisos`);
        },
        error: (err: unknown) => this.error.set(mensajeDeError(err)),
      });
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

  abrirEditar(permiso: Permiso): void {
    if (this.protegido(permiso)) {
      return;
    }
    this.editando.set(permiso);
    this.formulario.reset({
      nombre: permiso.nombre,
      descripcion: permiso.descripcion ?? '',
      activo: permiso.activo,
    });
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
    const peticion$ = editando ? this.permisosApi.actualizar(editando.id, peticion) : this.permisosApi.crear(peticion);

    peticion$.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (permiso) => {
        this.permisosLista.update((lista) =>
          editando ? lista.map((item) => (item.id === permiso.id ? permiso : item)) : [permiso, ...lista],
        );
        this.notificaciones.exito(editando ? 'Permiso actualizado' : 'Permiso creado', permiso.nombre);
        this.cerrarForm();
      },
      error: (err: unknown) => {
        const enCampo = aplicarErroresServidor(this.formulario, err, () => ({
          campo: 'nombre',
          mensaje: 'Ya existe un permiso con ese nombre.',
        }));
        if (!enCampo) {
          this.notificaciones.errorHttp('No se pudo guardar el permiso', err);
        }
      },
    });
  }

  /** Activar es inmediato; desactivar pide confirmación porque afecta a todos los usuarios. */
  alternarActivo(permiso: Permiso): void {
    if (this.protegido(permiso)) {
      return;
    }
    if (permiso.activo) {
      this.aDesactivar.set(permiso);
    } else {
      this.cambiarEstado(permiso, true);
    }
  }

  confirmarDesactivar(motivo: string): void {
    const permiso = this.aDesactivar();
    if (permiso) {
      this.cambiarEstado(permiso, false, motivo);
    }
  }

  private cambiarEstado(permiso: Permiso, activo: boolean, motivo?: string): void {
    if (this.cambiandoEstado()) {
      return;
    }
    this.cambiandoEstado.set(true);
    this.permisosApi
      .cambiarActivo(permiso.id, activo, motivo)
      .pipe(finalize(() => this.cambiandoEstado.set(false)))
      .subscribe({
        next: (actualizado) => {
          this.permisosLista.update((lista) => lista.map((item) => (item.id === actualizado.id ? actualizado : item)));
          this.aDesactivar.set(null);
          this.notificaciones.info(activo ? 'Permiso activado' : 'Permiso desactivado', actualizado.nombre);
        },
        error: (err: unknown) => this.notificaciones.errorHttp('No se pudo cambiar el estado', err),
      });
  }

  confirmarEliminar(permiso: Permiso): void {
    if (!this.protegido(permiso)) {
      this.aEliminar.set(permiso);
    }
  }

  eliminar(): void {
    const permiso = this.aEliminar();
    if (!permiso || this.eliminando()) {
      return;
    }
    this.eliminando.set(true);
    this.permisosApi
      .eliminar(permiso.id)
      .pipe(finalize(() => this.eliminando.set(false)))
      .subscribe({
        next: () => {
          this.permisosLista.update((lista) => lista.filter((item) => item.id !== permiso.id));
          this.notificaciones.exito('Permiso eliminado', permiso.nombre);
          this.aEliminar.set(null);
        },
        error: (err: unknown) => this.notificaciones.errorHttp('No se pudo eliminar el permiso', err),
      });
  }

  abrirRoles(permiso: Permiso): void {
    this.permisoRoles.set(permiso);
    this.rolesAbierto.set(true);
    this.cargandoRoles.set(true);
    this.permisosApi
      .roles(permiso.id)
      .pipe(finalize(() => this.cargandoRoles.set(false)))
      .subscribe({
        next: (roles) => this.rolesConPermiso.set(roles),
        error: (err: unknown) => this.notificaciones.errorHttp('No se pudieron cargar los roles', err),
      });
  }
}
