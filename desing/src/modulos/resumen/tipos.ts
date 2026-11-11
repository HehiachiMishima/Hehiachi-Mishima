/** GET /admin/analitica: indicadores del gobierno de accesos (DASHBOARD_ADMIN). */
export interface AnaliticaAdmin {
  kpis: KpisAdmin;
  usuariosPorRol: Conteo[];
  permisosMasOtorgados: Conteo[];
  coberturaPaneles: Conteo[];
  altasPorMes: PuntoAltas[];
}

export interface KpisAdmin {
  usuarios: number;
  usuariosActivos: number;
  usuariosSinRol: number;
  roles: number;
  rolesActivos: number;
  permisos: number;
  permisosActivos: number;
  overridesGrant: number;
  overridesDeny: number;
}

export interface Conteo {
  etiqueta: string;
  valor: number;
}

/** periodo yyyy-MM; valor = altas; secundario = altas que siguen activas. */
export interface PuntoAltas {
  periodo: string;
  valor: number;
  secundario: number;
}

/** Indicador de seguridad calculado desde la bitácora (NaN = no disponible). */
export interface IndicadorSeguridad {
  id: string;
  titulo: string;
  /** Enlace a Auditoría con el filtro equivalente. */
  enlace: string;
  valor: number | undefined;
}
