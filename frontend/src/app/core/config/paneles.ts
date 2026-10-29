import { PERMISOS } from './permisos';

export type GrupoModulo = 'supervision' | 'gestion';

export interface ModuloPanel {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  ruta: string;
  permiso: string;
  grupo: GrupoModulo;
}

export interface PanelDef {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  ruta: string;
  permiso: string;
  acento: string;
  modulos: ModuloPanel[];
}

export const NOMBRE_GRUPO: Record<GrupoModulo, string> = {
  supervision: 'Supervisión',
  gestion: 'Gestión',
};

export const PANEL_ADMIN: PanelDef = {
  id: 'admin',
  nombre: 'Administración',
  descripcion: 'Gobierno de identidades, accesos y trazabilidad del sistema.',
  icono: 'shield',
  ruta: '/admin',
  permiso: PERMISOS.PANEL_ADMIN,
  acento: 'brand',
  modulos: [
    {
      id: 'dashboard',
      nombre: 'Resumen',
      descripcion: 'Indicadores clave y riesgos del control de accesos.',
      icono: 'dashboard',
      ruta: 'dashboard',
      permiso: PERMISOS.DASHBOARD_ADMIN,
      grupo: 'supervision',
    },
    {
      id: 'auditoria',
      nombre: 'Auditoría',
      descripcion: 'Bitácora inmutable de accesos y cambios.',
      icono: 'history',
      ruta: 'auditoria',
      permiso: PERMISOS.VER_AUDITORIA,
      grupo: 'supervision',
    },
    {
      id: 'usuarios',
      nombre: 'Usuarios',
      descripcion: 'Altas, edición, estado y asignación de roles.',
      icono: 'usuarios',
      ruta: 'usuarios',
      permiso: PERMISOS.VER_USUARIOS,
      grupo: 'gestion',
    },
    {
      id: 'roles',
      nombre: 'Roles',
      descripcion: 'Roles y los permisos que conceden.',
      icono: 'roles',
      ruta: 'roles',
      permiso: PERMISOS.VER_ROLES,
      grupo: 'gestion',
    },
    {
      id: 'permisos',
      nombre: 'Permisos',
      descripcion: 'Catálogo de permisos del sistema.',
      icono: 'permisos',
      ruta: 'permisos',
      permiso: PERMISOS.VER_PERMISOS,
      grupo: 'gestion',
    },
  ],
};

export const PANELES: PanelDef[] = [PANEL_ADMIN];

export function panelesAccesibles(permisos: readonly string[]): PanelDef[] {
  return PANELES.filter((panel) => permisos.includes(panel.permiso));
}

export function primerModuloAccesible(panel: PanelDef, permisos: readonly string[]): ModuloPanel | undefined {
  return panel.modulos.find((modulo) => permisos.includes(modulo.permiso));
}
