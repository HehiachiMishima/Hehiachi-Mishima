/** Contratos de /api/monitoreo (ver backend oracle.monitoreo.Respuestas). */

export type EstadoSistema = 'OPERATIVO' | 'DEGRADADO' | 'CAIDO';

export interface VentanaMonitoreo {
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
  userAgent: string | null;
  idCorrelacion: string | null;
}

export interface IncidenciasMonitoreo {
  umbralLentoMs: number;
  errores: PeticionTraza[];
  lentas: PeticionTraza[];
}

export interface PresenciaUsuario {
  actorId: number;
  usuario: string | null;
  primeraVez: string;
  ultimaVez: string;
  ip: string | null;
  userAgent: string | null;
  ultimaRuta: string | null;
  peticiones: number;
  errores: number;
}

export interface JvmMonitoreo {
  heapUsadoBytes: number;
  heapMaxBytes: number;
  noHeapUsadoBytes: number;
  /** Porcentaje 0..100; -1 si no está disponible. */
  cpuProceso: number;
  cpuSistema: number;
  procesadores: number;
  hilos: number;
  hilosPico: number;
  gcConteo: number;
  gcTiempoMs: number;
  version: string;
}

export interface BaseDatosMonitoreo {
  disponible: boolean;
  latenciaMs: number | null;
  poolActivas: number | null;
  poolInactivas: number | null;
  poolTotal: number | null;
  poolEsperando: number | null;
  poolMaximo: number | null;
  tamanoBytes: number | null;
  conexionesServidor: number | null;
}

export interface ColasMonitoreo {
  auditoriaPendientes: number;
  auditoriaDescartados: number;
  trazasPendientes: number;
  trazasDescartadas: number;
  trazasPersistidas: boolean;
  retencionDias: number;
}

export interface SistemaMonitoreo {
  estado: EstadoSistema;
  alertas: string[];
  iniciadoEn: string;
  uptimeSegundos: number;
  enVuelo: number;
  jvm: JvmMonitoreo;
  baseDatos: BaseDatosMonitoreo;
  colas: ColasMonitoreo;
}

export interface ResumenMonitoreo {
  generadoEn: string;
  sistema: SistemaMonitoreo;
  ventana: VentanaMonitoreo;
  ultimos5: VentanaMonitoreo;
  usuariosActivos: number;
}

export interface ConteoMonitoreo {
  etiqueta: string;
  valor: number;
}

export interface ActividadUsuario {
  actorId: number;
  dias: number;
  peticiones: number;
  errores: number;
  primera: string | null;
  ultima: string | null;
  porDia: ConteoMonitoreo[];
  rutas: ConteoMonitoreo[];
  ips: ConteoMonitoreo[];
  estados: ConteoMonitoreo[];
}

export interface FiltroPeticiones {
  desde?: string;
  hasta?: string;
  actorId?: number;
  metodo?: string;
  ruta?: string;
  /** 2xx | 3xx | 4xx | 5xx | errores | código exacto. */
  estado?: string;
  minMs?: number;
  idCorrelacion?: string;
  pagina?: number;
  tamano?: number;
}
