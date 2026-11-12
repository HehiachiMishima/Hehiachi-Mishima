/**
 * Configuración de la app en un solo lugar: lo que cambia entre entornos o por diseño.
 * Variables de Vite (VITE_*) en .env.local para sobrescribir en local.
 */
export const ENTORNO = {
  /** Base de la API (el proxy de Vite la reenvía al backend). */
  apiBase: "/api",
  /** Consola Angular, para los módulos que aún no están en esta app. */
  consolaAngularUrl: import.meta.env.VITE_CONSOLA_ANGULAR_URL ?? "http://localhost:4200",
  nombreProducto: "Hehiachi Mishima",
  /**
   * Zona del backend (APP_ZONA_HORARIA, por defecto America/Lima). Las fechas de altas y cambios
   * (creadoEn, actualizadoEn) llegan SIN zona en esta hora; la bitácora y el monitoreo, con "Z".
   */
  zonaNegocio: import.meta.env.VITE_ZONA_NEGOCIO ?? "America/Lima",
  sesion: {
    /** Antelación con la que se decide renovar (y, si hubo inactividad, avisar). WCAG 2.2.1: ≥ 20 s. */
    avisoMs: 120_000,
    /** Inactividad máxima en la pestaña para renovar sin preguntar (el servidor tiene su propio límite). */
    inactividadMaxMs: 30 * 60_000,
  },
  avisos: {
    /** Tiempo que un aviso de éxito o informativo permanece antes de retirarse solo. */
    duracionMs: 6_000,
  },
  monitoreo: {
    /** Refresco automático del tablero. */
    intervaloMs: 15_000,
  },
} as const;
