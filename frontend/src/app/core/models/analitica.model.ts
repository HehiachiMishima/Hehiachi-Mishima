/** GET /admin/analitica: indicadores ejecutivos del gobierno de accesos. */
export interface AnaliticaAdmin {
  kpis: KpisAdmin;
  usuariosPorRol: Conteo[];
  permisosMasOtorgados: Conteo[];
  coberturaPaneles: Conteo[];
  altasPorMes: PuntoSerie[];
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
export interface PuntoSerie {
  periodo: string;
  valor: number;
  secundario: number;
}
