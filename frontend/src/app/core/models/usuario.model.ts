export interface Usuario {
  id: number;
  usuario: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string | null;
  creadoPor: number | null;
  actualizadoPor: number | null;
  /** true si la entidad está protegida (base del sistema o la propia cuenta): la UI deshabilita las acciones. */
  protegido?: boolean;
}

export interface UsuarioCrearRequest {
  usuario: string;
  contrasena: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string | null;
  activo?: boolean;
}

export interface UsuarioActualizarRequest {
  usuario?: string;
  contrasena?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  telefono?: string | null;
  activo?: boolean;
}

export interface UsuarioFiltro {
  usuario?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  activo?: boolean;
}

/** Fila de GET /usuarios/resumen: roles asignados y permisos efectivos (deny-wins) del usuario. */
export interface UsuarioResumen {
  usuarioId: number;
  roles: string[];
  permisos: string[];
}
