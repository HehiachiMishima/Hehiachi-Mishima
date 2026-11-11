/** Contrato de /api/monitoreo/peticiones y /usuarios/{id}/actividad (backend: oracle.monitoreo.Respuestas). */
export interface PeticionTraza {
  id: number | null;
  ocurridoEn: string;
  metodo: string;
  /** Plantilla del endpoint (/usuarios/{id}). */
  ruta: string;
  /** Ruta real llamada (/usuarios/42). */
  uri: string;
  estado: number;
  duracionMs: number;
  actorId: number | null;
  actorUsuario: string | null;
  ip: string | null;
  userAgent: string | null;
  idCorrelacion: string | null;
}

export interface Conteo {
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
  /** Zona IANA en la que se agruparon los días. */
  zona: string;
  /** etiqueta = día YYYY-MM-DD en `zona`. */
  porDia: Conteo[];
  rutas: Conteo[];
  ips: Conteo[];
  estados: Conteo[];
}

export interface FiltroPeticiones {
  desde?: string;
  hasta?: string;
  actorId?: number;
  metodo?: string;
  ruta?: string;
  /** 2xx | 4xx | 5xx | errores | código exacto. */
  estado?: string;
  minMs?: number;
  idCorrelacion?: string;
  pagina?: number;
  tamano?: number;
}
