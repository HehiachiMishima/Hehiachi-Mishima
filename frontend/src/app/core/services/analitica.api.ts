import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AnaliticaAdmin } from '../models';
import { Api } from './api';

/** Indicadores ejecutivos del panel de administración (DASHBOARD_ADMIN). */
@Service()
export class AnaliticaApi {
  private readonly api = inject(Api);

  admin(): Observable<AnaliticaAdmin> {
    return this.api.get<AnaliticaAdmin>('/admin/analitica');
  }
}
