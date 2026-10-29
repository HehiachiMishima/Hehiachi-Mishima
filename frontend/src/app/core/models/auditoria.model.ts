export type ResultadoAuditoria = 'EXITO' | 'FALLO' | 'DENEGADO';

/** Evento de la bitácora append-only (GET /auditoria). */
export interface AuditoriaEvento {
  id: number;
  /** Instante UTC. */
  ocurridoEn: string;
  /** null = anónimo (login fallido); 0 = sistema. */
  actorId: number | null;
  actorUsuario: string | null;
  accion: string;
  entidad: string | null;
  entidadId: string | null;
  resultado: ResultadoAuditoria | string;
  ip: string | null;
  userAgent: string | null;
  idCorrelacion: string | null;
  detalle: DetalleAuditoria | null;
}

/** {antes, despues} en cambios de datos o {motivo} en rechazos. */
export interface DetalleAuditoria {
  antes?: Record<string, unknown> | null;
  despues?: Record<string, unknown> | null;
  motivo?: string;
  [clave: string]: unknown;
}

export interface CatalogoAuditoria {
  acciones: string[];
  entidades: string[];
  resultados: string[];
}

/** Filtros de GET /auditoria y /auditoria/exportar (todos opcionales). */
export interface FiltroAuditoria {
  pagina?: number;
  tamano?: number;
  desde?: string;
  hasta?: string;
  actorId?: number;
  accion?: string;
  entidad?: string;
  entidadId?: string;
  resultado?: string;
  q?: string;
  /** TIPO:id — eventos de ese registro o de relaciones que lo incluyen (p. ej. USUARIO:42). */
  relacionadoCon?: string;
}
