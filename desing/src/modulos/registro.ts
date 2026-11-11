import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { AppLayoutProps } from "@cloudscape-design/components/app-layout";
import type { IconProps } from "@cloudscape-design/components/icon";
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
  /** Icono del sistema (accesos rápidos). */
  icono: IconProps.Name;
  /** Insignia junto al enlace del menú lateral (p. ej. "En vivo"). */
  insignia?: { texto: string; color: "blue" | "green" | "red" | "grey" };
  /** Ayuda contextual del panel de herramientas (enlace "Info" del título). */
  ayuda: { resumen: string; puntos: string[] };
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
    icono: "bar-chart",
    ayuda: {
      resumen: "Tablero de entrada del administrador: cifras de cuentas, roles y permisos, y lo que conviene revisar hoy.",
      puntos: [
        "Las cifras enlazan a la lista que las explica (p. ej. cuentas sin rol).",
        "\"Requiere atención\" mezcla riesgos de configuración y los últimos fallos o denegaciones de la bitácora.",
        "Los indicadores de seguridad se calculan sobre la auditoría y solo aparecen si puedes verla.",
      ],
    },
    pagina: lazy(() => import("./resumen/ResumenPagina")),
  },
  {
    id: "auditoria",
    titulo: "Auditoría",
    descripcion: "Bitácora inmutable de accesos y cambios, con detalle de antes y después.",
    grupo: "supervision",
    permiso: PERMISOS.VER_AUDITORIA,
    tipoContenido: "table",
    icono: "history",
    ayuda: {
      resumen: "Registro inalterable de inicios de sesión y cambios de acceso. Nada se puede editar ni borrar.",
      puntos: [
        "Los filtros viajan en la URL: copia el enlace para compartir una búsqueda.",
        "Selecciona un evento para ver quién, desde dónde y qué cambió (antes y después).",
        "\"Exportar CSV\" descarga hasta 50 000 eventos con los filtros activos.",
      ],
    },
    pagina: lazy(() => import("./auditoria/AuditoriaPagina")),
  },
  {
    id: "monitoreo",
    titulo: "Monitoreo",
    descripcion: "Salud del sistema, tráfico, latencias, incidencias y usuarios conectados en vivo.",
    grupo: "supervision",
    permiso: PERMISOS.VER_MONITOREO,
    tipoContenido: "dashboard",
    icono: "heart",
    insignia: { texto: "En vivo", color: "green" },
    ayuda: {
      resumen: "Salud de la API en tiempo real: disponibilidad, tráfico, latencias, errores y quién está conectado.",
      puntos: [
        "La ventana (5 min, 15 min, 1 h) cambia las cifras y la tabla de endpoints.",
        "p95: el 95 % de las peticiones respondió en menos de ese tiempo.",
        "Cada endpoint, error o usuario enlaza a su traza en Actividad.",
      ],
    },
    pagina: lazy(() => import("./monitoreo/MonitoreoPagina")),
  },
  {
    id: "actividad",
    titulo: "Actividad",
    descripcion: "Traza de cada petición por usuario: qué hizo, cuándo y con qué resultado.",
    grupo: "supervision",
    permiso: PERMISOS.VER_MONITOREO,
    tipoContenido: "table",
    icono: "search",
    ayuda: {
      resumen: "Traza de cada petición: usuario, operación, resultado y duración.",
      puntos: [
        "Filtra por un usuario para ver su resumen: volumen, errores, IP y endpoints.",
        "El id de petición (X-Request-Id) enlaza la traza con la auditoría.",
        "\"Solo lentas\" muestra las peticiones de 1 s o más.",
      ],
    },
    pagina: lazy(() => import("./actividad/ActividadPagina")),
  },
  {
    id: "usuarios",
    titulo: "Usuarios",
    descripcion: "Altas, edición, estado, roles, permisos individuales y sesiones.",
    grupo: "gestion",
    permiso: PERMISOS.VER_USUARIOS,
    tipoContenido: "table",
    icono: "user-profile",
    ayuda: {
      resumen: "Cuentas con acceso a la plataforma, sus roles y sus permisos efectivos.",
      puntos: [
        "Un usuario recibe los permisos de sus roles; puedes conceder o denegar permisos concretos.",
        "Una denegación individual siempre prevalece sobre cualquier rol.",
        "Las cuentas protegidas (base del sistema o la tuya) no se pueden modificar.",
      ],
    },
    pagina: lazy(() => import("./usuarios/UsuariosModulo")),
  },
  {
    id: "roles",
    titulo: "Roles",
    descripcion: "Roles y los permisos que conceden a sus usuarios.",
    grupo: "gestion",
    permiso: PERMISOS.VER_ROLES,
    tipoContenido: "table",
    icono: "group",
    ayuda: {
      resumen: "Los roles agrupan permisos y se asignan a usuarios.",
      puntos: [
        "Los cambios en un rol se aplican al instante a todos sus usuarios.",
        "Desactivar un rol conserva las asignaciones y deja de conceder sus permisos.",
        "Los roles protegidos solo admiten agregar permisos.",
      ],
    },
    pagina: lazy(() => import("./roles/RolesModulo")),
  },
  {
    id: "permisos",
    titulo: "Permisos",
    descripcion: "Catálogo de permisos del sistema y qué roles los conceden.",
    grupo: "gestion",
    permiso: PERMISOS.VER_PERMISOS,
    tipoContenido: "table",
    icono: "key",
    ayuda: {
      resumen: "Catálogo de permisos del sistema; se conceden mediante roles o ajustes individuales.",
      puntos: [
        "Un permiso inactivo no concede acceso aunque un rol lo tenga.",
        "Los permisos base del sistema no se pueden modificar ni eliminar.",
      ],
    },
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
