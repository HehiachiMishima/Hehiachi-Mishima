/**
 * Configuración transversal de la aplicación en un único punto:
 * claves de almacenamiento, rutas de navegación, duraciones de UI y
 * márgenes de sesión. Evita "números y cadenas mágicas" repartidos por el
 * código y concentra aquí lo que cambia entre entornos o por diseño.
 */
export const CONFIG = {
  almacenamiento: {
    sesion: 'oracle.sesion',
    tema: 'oracle.tema',
    animacionPausada: 'oracle.animacion-pausada',
  },
  rutas: {
    login: '/login',
    inicio: '/',
    sinAcceso: '/sin-acceso',
    auditoria: '/admin/auditoria',
  },
  notificaciones: {
    /** Duración de los avisos no críticos; se pausa al pasar el puntero o el foco. Los errores no se cierran solos. */
    duracion: 6000,
    /** Tiempo para usar "Deshacer" en cambios de acceso reversibles. */
    duracionDeshacer: 8000,
  },
  sesion: {
    /** Margen (ms) antes del vencimiento real para forzar el cierre. */
    margenExpiracionMs: 0,
    /** Antelación (ms) con la que se avisa de que la sesión va a vencer (WCAG 2.2.1). */
    avisoExpiracionMs: 120_000,
  },
  busqueda: {
    debounceMs: 300,
  },
  paginacion: {
    opciones: [10, 25, 50, 100],
  },
} as const;
