/** Contrato de /api/permisos (backend: PermisoResponse). */
export interface Permiso {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string | null;
  creadoPor: number | null;
  actualizadoPor: number | null;
  /** Permiso base del sistema: no se modifica ni elimina. */
  protegido?: boolean;
}

export interface PermisoGuardar {
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface RolDePermiso {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export type AccionPermiso = "detalle" | "editar" | "activar" | "desactivar" | "eliminar";
