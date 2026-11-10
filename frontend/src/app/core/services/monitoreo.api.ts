import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActividadUsuario,
  FiltroPeticiones,
  IncidenciasMonitoreo,
  PaginaResponse,
  PeticionTraza,
  PresenciaUsuario,
  PuntoMonitoreo,
  ResumenMonitoreo,
  RutaMonitoreo,
} from '../models';
import { Api } from './api';

/** Monitoreo administrativo (solo lectura). Requiere VER_MONITOREO. */
@Service()
export class MonitoreoApi {
  private readonly api = inject(Api);

  resumen(minutos: number): Observable<ResumenMonitoreo> {
    return this.api.get<ResumenMonitoreo>('/monitoreo/resumen', { minutos });
  }

  serie(minutos: number): Observable<PuntoMonitoreo[]> {
    return this.api.get<PuntoMonitoreo[]>('/monitoreo/serie', { minutos });
  }

  rutas(minutos: number): Observable<RutaMonitoreo[]> {
    return this.api.get<RutaMonitoreo[]>('/monitoreo/rutas', { minutos });
  }

  incidencias(): Observable<IncidenciasMonitoreo> {
    return this.api.get<IncidenciasMonitoreo>('/monitoreo/incidencias');
  }

  usuariosActivos(minutos: number): Observable<PresenciaUsuario[]> {
    return this.api.get<PresenciaUsuario[]>('/monitoreo/usuarios-activos', { minutos });
  }

  peticiones(filtro: FiltroPeticiones): Observable<PaginaResponse<PeticionTraza>> {
    return this.api.get<PaginaResponse<PeticionTraza>>('/monitoreo/peticiones', { ...filtro });
  }

  /** `zona` (IANA) decide en qué días de calendario se agrupa `porDia`. */
  actividad(actorId: number, dias: number, zona: string): Observable<ActividadUsuario> {
    return this.api.get<ActividadUsuario>(`/monitoreo/usuarios/${actorId}/actividad`, { dias, zona });
  }
}
