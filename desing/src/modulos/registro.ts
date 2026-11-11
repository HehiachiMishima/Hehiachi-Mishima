import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { AppLayoutProps } from "@cloudscape-design/components/app-layout";
import { PERMISOS, type Permiso } from "@/core/sesion/permisos";

/**
 * Registro ÚNICO de módulos: de aquí salen las rutas, el menú lateral, las migas y la
 * comprobación de permisos. Agregar un módulo = crear su carpeta en modulos/ y una entrada aquí.
 * Cada página se descarga solo al visitarla (code splitting). Un módulo con subpáginas (detalle,
 * alta) declara sus propias <Routes> en su componente raíz: la ruta del registro es `/{id}/*`.
 */

export const GRUPOS = [
  { id: "supervision", titulo: "Supervisión" },
  { id: "gestion", titulo: "Gestión" },
] as const;

export type GrupoId = (typeof GRUPOS)[number]["id"];

export interface ModuloDef {
  /** Único; también es el segmento de URL (/monitoreo). */
  id: string;
  titulo: string;
  descripcion: string;
  grupo: GrupoId;
  permiso: Permiso;
  /** Disposición de AppLayout para la página (tabla, panel, formulario...). */
  tipoContenido: AppLayoutProps.ContentType;
  pagina: LazyExoticComponent<ComponentType>;
}

export const MODULOS: readonly ModuloDef[] = [
  {
    id: "resumen",
    titulo: "Resumen",
    descripcion: "Indicadores clave, riesgos del control de accesos y lo que requiere atención.",
    grupo: "supervision",
    permiso: PERMISOS.DASHBOARD_ADMIN,
    tipoContenido: "dashboard",
    pagina: lazy(() => import("./resumen/ResumenPagina")),
  },
  {
    id: "auditoria",
    titulo: "Auditoría",
    descripcion: "Bitácora inmutable de accesos y cambios, con detalle de antes y después.",
    grupo: "supervision",
    permiso: PERMISOS.VER_AUDITORIA,
    tipoContenido: "table",
    pagina: lazy(() => import("./auditoria/AuditoriaPagina")),
  },
  {
    id: "monitoreo",
    titulo: "Monitoreo",
    descripcion: "Salud del sistema, tráfico, latencias, incidencias y usuarios conectados en vivo.",
    grupo: "supervision",
    permiso: PERMISOS.VER_MONITOREO,
    tipoContenido: "dashboard",
    pagina: lazy(() => import("./monitoreo/MonitoreoPagina")),
  },
  {
    id: "actividad",
    titulo: "Actividad",
    descripcion: "Traza de cada petición por usuario: qué hizo, cuándo y con qué resultado.",
    grupo: "supervision",
    permiso: PERMISOS.VER_MONITOREO,
    tipoContenido: "table",
    pagina: lazy(() => import("./actividad/ActividadPagina")),
  },
  {
    id: "usuarios",
    titulo: "Usuarios",
    descripcion: "Altas, edición, estado, roles, permisos individuales y sesiones.",
    grupo: "gestion",
    permiso: PERMISOS.VER_USUARIOS,
    tipoContenido: "table",
    pagina: lazy(() => import("./usuarios/UsuariosModulo")),
  },
  {
    id: "roles",
    titulo: "Roles",
    descripcion: "Roles y los permisos que conceden a sus usuarios.",
    grupo: "gestion",
    permiso: PERMISOS.VER_ROLES,
    tipoContenido: "table",
    pagina: lazy(() => import("./roles/RolesModulo")),
  },
  {
    id: "permisos",
    titulo: "Permisos",
    descripcion: "Catálogo de permisos del sistema y qué roles los conceden.",
    grupo: "gestion",
    permiso: PERMISOS.VER_PERMISOS,
    tipoContenido: "table",
    pagina: lazy(() => import("./permisos/PermisosModulo")),
  },
];

export const rutaDe = (m: Pick<ModuloDef, "id">): string => `/${m.id}`;

export function modulosAccesibles(permisos: readonly string[], modulos: readonly ModuloDef[] = MODULOS): ModuloDef[] {
  return modulos.filter((m) => permisos.includes(m.permiso));
}

/** Módulos accesibles agrupados en el orden de GRUPOS (grupos vacíos fuera). */
export function menuPorGrupos(permisos: readonly string[], modulos: readonly ModuloDef[] = MODULOS) {
  const accesibles = modulosAccesibles(permisos, modulos);
  return GRUPOS.map((g) => ({ ...g, modulos: accesibles.filter((m) => m.grupo === g.id) })).filter((g) => g.modulos.length > 0);
}
