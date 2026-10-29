import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuditoriaEvento, CatalogoAuditoria, FiltroAuditoria, PaginaResponse } from '../models';
import { Api } from './api';

/** Bitácora de auditoría (solo lectura). Requiere VER_AUDITORIA. */
@Service()
export class AuditoriaApi {
  private readonly api = inject(Api);
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl.replace(/\/+$/, '');

  buscar(filtro: FiltroAuditoria): Observable<PaginaResponse<AuditoriaEvento>> {
    return this.api.get<PaginaResponse<AuditoriaEvento>>('/auditoria', { ...filtro });
  }

  obtener(id: number): Observable<AuditoriaEvento> {
    return this.api.get<AuditoriaEvento>(`/auditoria/${id}`);
  }

  catalogo(): Observable<CatalogoAuditoria> {
    return this.api.get<CatalogoAuditoria>('/auditoria/catalogo');
  }

  /**
   * CSV con los filtros activos. Se descarga con HttpClient (y no con un
   * enlace) para que la petición lleve el Bearer del interceptor.
   */
  exportar(filtro: FiltroAuditoria): Observable<HttpResponse<Blob>> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor !== undefined && valor !== null && valor !== '' && clave !== 'pagina' && clave !== 'tamano') {
        params = params.set(clave, String(valor));
      }
    }
    return this.http.get(`${this.base}/auditoria/exportar`, {
      params,
      observe: 'response',
      responseType: 'blob',
    });
  }
}
