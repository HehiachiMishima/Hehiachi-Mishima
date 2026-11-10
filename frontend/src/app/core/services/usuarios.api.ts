import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  PermisoEfectivo,
  PermisoFinal,
  Rol,
  Usuario,
  UsuarioActualizarRequest,
  UsuarioCrearRequest,
  UsuarioFiltro,
  UsuarioPermisoDetalle,
  UsuarioPermisoOverride,
  UsuarioResumen,
} from '../models';
import { Api } from './api';

@Service()
export class UsuariosApi {
  private readonly api = inject(Api);

  listar(): Observable<Usuario[]> {
    return this.api.get<Usuario[]>('/usuarios');
  }

  buscar(filtro: UsuarioFiltro): Observable<Usuario[]> {
    return this.api.get<Usuario[]>('/usuarios/buscar', { ...filtro });
  }

  /**
   * Roles y permisos efectivos en una sola petición. Con `ids` (máx. 500,
   * p. ej. la página visible) solo resuelve esos usuarios.
   */
  resumen(ids?: readonly number[]): Observable<UsuarioResumen[]> {
    return this.api.get<UsuarioResumen[]>('/usuarios/resumen', ids?.length ? { ids: ids.join(',') } : undefined);
  }

  obtener(id: number): Observable<Usuario> {
    return this.api.get<Usuario>(`/usuarios/${id}`);
  }

  crear(peticion: UsuarioCrearRequest): Observable<Usuario> {
    return this.api.post<Usuario>('/usuarios', peticion);
  }

  actualizar(id: number, peticion: UsuarioActualizarRequest): Observable<Usuario> {
    return this.api.put<Usuario>(`/usuarios/${id}`, peticion);
  }

  eliminar(id: number): Observable<void> {
    return this.api.delete<void>(`/usuarios/${id}`);
  }

  /** `motivo` (opcional, máx. 200) queda en el detalle de la auditoría. */
  cambiarActivo(id: number, activo: boolean, motivo?: string): Observable<Usuario> {
    return this.api.patch<Usuario>(`/usuarios/${id}/activo`, motivo ? { activo, motivo } : { activo });
  }

  /** Cierra todas las sesiones abiertas (revoca sus tokens). `motivo` va a la auditoría. */
  cerrarSesiones(id: number, motivo?: string): Observable<void> {
    return this.api.post<void>(`/usuarios/${id}/sesiones/cerrar`, motivo ? { motivo } : {});
  }

  roles(id: number): Observable<Rol[]> {
    return this.api.get<Rol[]>(`/usuarios/${id}/roles`);
  }

  asignarRol(id: number, rolId: number): Observable<unknown> {
    return this.api.post(`/usuarios/${id}/roles`, { rolId });
  }

  quitarRol(id: number, rolId: number): Observable<void> {
    return this.api.delete<void>(`/usuarios/${id}/roles/${rolId}`);
  }

  /** Overrides individuales (grant/deny) del usuario. */
  permisos(id: number): Observable<UsuarioPermisoDetalle[]> {
    return this.api.get<UsuarioPermisoDetalle[]>(`/usuarios/${id}/permisos`);
  }

  /** Concede (otorgado=true) o deniega (otorgado=false) un permiso al usuario. */
  otorgarPermiso(id: number, override: UsuarioPermisoOverride): Observable<UsuarioPermisoDetalle> {
    return this.api.put<UsuarioPermisoDetalle>(`/usuarios/${id}/permisos`, override);
  }

  /** Elimina el override; el permiso vuelve a heredarse del rol. */
  quitarPermiso(id: number, permisoId: number): Observable<void> {
    return this.api.delete<void>(`/usuarios/${id}/permisos/${permisoId}`);
  }

  /** Resolución: aportes del rol y de los overrides, antes de aplicar MIN(). */
  resolucionEfectivos(id: number): Observable<PermisoEfectivo[]> {
    return this.api.get<PermisoEfectivo[]>(`/resolucion/usuarios/${id}/efectivos`);
  }

  /** Resolución final: permitido = MIN(otorgado) => deny-wins ya aplicado. */
  resolucionFinales(id: number): Observable<PermisoFinal[]> {
    return this.api.get<PermisoFinal[]>(`/resolucion/usuarios/${id}/finales`);
  }
}
