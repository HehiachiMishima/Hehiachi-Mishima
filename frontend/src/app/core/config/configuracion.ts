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
  },
  rutas: {
    login: '/login',
    inicio: '/',
    sinAcceso: '/sin-acceso',
  },
  notificaciones: {
    /** Duración de los avisos no críticos; se pausa al pasar el puntero o el foco. Los errores no se cierran solos. */
    duracion: 6000,
    /** Tiempo para usar "Deshacer" en cambios de acceso reversibles. */
    duracionDeshacer: 8000,
  },
  sesion: {
    /**
     * Antelación (ms) con la que se decide renovar el access token antes de que
     * venza: si hubo actividad reciente se renueva en silencio; si no, se avisa
     * (WCAG 2.2.1: al menos 20 s para pedir más tiempo con una sola acción).
     */
    avisoExpiracionMs: 120_000,
    /**
     * Inactividad máxima en la pestaña (ms) para renovar sin preguntar. El
     * servidor aplica además su propio límite (app.refresh.inactividad-min) y
     * un máximo absoluto desde el login (app.refresh.max-horas).
     */
    inactividadMaxMs: 30 * 60_000,
  },
  busqueda: {
    debounceMs: 300,
  },
  paginacion: {
    opciones: [10, 25, 50, 100],
  },
} as const;
