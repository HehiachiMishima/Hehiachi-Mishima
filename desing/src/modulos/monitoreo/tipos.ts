/** Contrato de /api/monitoreo (backend: oracle.monitoreo.Respuestas). */

export type EstadoSistema = "OPERATIVO" | "DEGRADADO" | "CAIDO";
export type VentanaMinutos = 5 | 15 | 60;

export interface Ventana {
  minutos: number;
  peticiones: number;
  porMinuto: number;
  errores4xx: number;
  errores5xx: number;
  /** Porcentaje 0..100. */
  tasaError5xx: number;
  promedioMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

export interface Sistema {
  estado: EstadoSistema;
  alertas: string[];
  iniciadoEn: string;
  uptimeSegundos: number;
  enVuelo: number;
  jvm: {
    heapUsadoBytes: number;
    heapMaxBytes: number;
    /** 0..100; -1 si no está disponible. */
    cpuProceso: number;
    procesadores: number;
    hilos: number;
  };
  baseDatos: {
    disponible: boolean;
    latenciaMs: number | null;
    poolActivas: number | null;
    poolMaximo: number | null;
    poolEsperando: number | null;
  };
  colas: {
    auditoriaPendientes: number;
    auditoriaDescartados: number;
    trazasPendientes: number;
    retencionDias: number;
  };
}

export interface ResumenMonitoreo {
  generadoEn: string;
  sistema: Sistema;
  ventana: Ventana;
  usuariosActivos: number;
}

export interface PuntoMonitoreo {
  minuto: string;
  peticiones: number;
  errores4xx: number;
  errores5xx: number;
  promedioMs: number;
  p95Ms: number;
  maxMs: number;
}

export interface RutaMonitoreo {
  metodo: string;
  ruta: string;
  peticiones: number;
  errores4xx: number;
  errores5xx: number;
  promedioMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}

export interface Presencia {
  actorId: number;
  usuario: string | null;
  ultimaVez: string;
  ip: string | null;
  ultimaRuta: string | null;
  peticiones: number;
  errores: number;
}

/** Petición de la traza (incidencias recientes). */
export interface PeticionTraza {
  id: number | null;
  ocurridoEn: string;
  metodo: string;
  ruta: string;
  uri: string;
  estado: number;
  duracionMs: number;
  actorId: number | null;
  actorUsuario: string | null;
  ip: string | null;
  idCorrelacion: string | null;
}

/** Últimas respuestas con error (4xx y 5xx) y peticiones lentas (ventana corta, del backend). */
export interface Incidencias {
  umbralLentoMs: number;
  errores: PeticionTraza[];
  lentas: PeticionTraza[];
}
