/** Contrato de /api/usuarios y relacionados (backend: UsuarioResponse, RolResponse...). */
export interface Usuario {
  id: number;
  usuario: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  activo: boolean;
  /** LocalDateTime en UTC, sin zona. */
  creadoEn: string;
  actualizadoEn: string | null;
  creadoPor: number | null;
  actualizadoPor: number | null;
  /** Usuario protegido o la propia cuenta: la UI deshabilita sus acciones. */
  protegido: boolean;
}

export interface UsuarioGuardar {
  usuario: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  activo: boolean;
  /** Solo al crear (o al restablecer). */
  contrasena?: string;
}

/** Fila de GET /usuarios/resumen: roles y permisos efectivos (deny-wins) del usuario. */
export interface UsuarioResumen {
  usuarioId: number;
  roles: string[];
  permisos: string[];
}

export interface Rol {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  protegido?: boolean;
}

export interface Permiso {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

/** Ajuste individual (override) de un usuario sobre un permiso. */
export interface UsuarioPermisoDetalle {
  usuarioId: number;
  permisoId: number;
  permisoNombre: string;
  otorgado: boolean;
}

/** Aporte del ROL o de un OVERRIDE antes de aplicar MIN() (v_permisos_efectivos). */
export interface PermisoEfectivo {
  usuarioId: number;
  permisoId: number;
  otorgado: boolean;
  origen: "ROL" | "OVERRIDE" | string;
  roles?: string[];
}

/** Resultado final (v_permisos_finales): permitido = MIN(otorgado), la denegación prevalece. */
export interface PermisoFinal {
  usuarioId: number;
  permisoId: number;
  permitido: boolean;
}

export type Ajuste = "heredar" | "conceder" | "denegar";

/** Acciones de fila (lista y detalle). */
export type AccionUsuario = "detalle" | "editar" | "activar" | "desactivar" | "cerrarSesiones" | "restablecer" | "actividad" | "eliminar";
