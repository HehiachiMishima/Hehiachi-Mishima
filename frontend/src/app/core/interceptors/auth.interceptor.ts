import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SesionStore } from '../services/sesion';

const BASE_API = environment.apiUrl.replace(/\/+$/, '');

/** true si la URL pertenece a la API propia (el Bearer nunca sale hacia terceros). */
function esApiPropia(url: string): boolean {
  return url === BASE_API || url.startsWith(`${BASE_API}/`) || url.startsWith(`${BASE_API}?`);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sesionStore = inject(SesionStore);
  const token = sesionStore.autenticado() ? sesionStore.sesion()?.token : null;

  if (token && esApiPropia(req.url) && !req.headers.has('Authorization')) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
  return next(req);
};
