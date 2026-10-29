export interface Permiso {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string | null;
  creadoPor: number | null;
  actualizadoPor: number | null;
  /** true si la entidad está protegida (base del sistema o la propia cuenta): la UI deshabilita las acciones. */
  protegido?: boolean;
}

export interface PermisoCrearRequest {
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
}

export interface PermisoActualizarRequest {
  nombre?: string;
  descripcion?: string | null;
  activo?: boolean;
}

export interface PermisoFiltro {
  nombre?: string;
  descripcion?: string;
  activo?: boolean;
}

export interface UsuarioPermisoOverride {
  permisoId: number;
  otorgado: boolean;
}

/** Fila de override individual (grant/deny) de un usuario sobre un permiso. */
export interface UsuarioPermisoDetalle {
  usuarioId: number;
  usuario: string;
  permisoId: number;
  permisoNombre: string;
  otorgado: boolean;
  creadoEn: string;
  actualizadoEn: string | null;
}

/** Fila de v_permisos_efectivos: aporte del ROL (true) o de un OVERRIDE, antes de MIN(). */
export interface PermisoEfectivo {
  usuarioId: number;
  permisoId: number;
  otorgado: boolean;
  origen: 'ROL' | 'OVERRIDE' | string;
  /** Rol(es) de origen cuando origen = ROL; explica por qué se concede el permiso. */
  roles?: string[];
}

/** Fila de v_permisos_finales: permitido = MIN(otorgado) => deny-overrides aplicado. */
export interface PermisoFinal {
  usuarioId: number;
  permisoId: number;
  permitido: boolean;
}
