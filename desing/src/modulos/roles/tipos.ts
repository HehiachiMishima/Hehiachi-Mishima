/** Contrato de /api/roles (backend: RolResponse). */
export interface Rol {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string | null;
  creadoPor: number | null;
  actualizadoPor: number | null;
  /** Rol base del sistema: no se modifica ni elimina; solo se le pueden agregar permisos. */
  protegido?: boolean;
}

export interface RolGuardar {
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface Permiso {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface UsuarioDeRol {
  id: number;
  usuario: string;
  nombre: string;
  apellido: string;
  email: string;
  activo: boolean;
}

export type AccionRol = "detalle" | "editar" | "activar" | "desactivar" | "eliminar";
