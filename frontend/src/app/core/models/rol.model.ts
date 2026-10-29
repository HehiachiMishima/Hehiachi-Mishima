export interface Rol {
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

export interface RolCrearRequest {
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
}

export interface RolActualizarRequest {
  nombre?: string;
  descripcion?: string | null;
  activo?: boolean;
}

export interface RolFiltro {
  nombre?: string;
  descripcion?: string;
  activo?: boolean;
}
