import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SesionStore } from '../services/sesion';
import { RUTAS_SESION } from './contexto';

const BASE_API = environment.apiUrl.replace(/\/+$/, '');

/** true si la URL pertenece a la API propia (el Bearer nunca sale hacia terceros). */
function esApiPropia(url: string): boolean {
  return url === BASE_API || url.startsWith(`${BASE_API}/`) || url.startsWith(`${BASE_API}?`);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sesionStore = inject(SesionStore);
  const token = sesionStore.autenticado() ? sesionStore.sesion()?.token : null;

  // login/refresh/logout van sin Bearer: un token vencido haría que el servidor los rechace con 401.
  const esRutaSesion = RUTAS_SESION.some((ruta) => req.url.endsWith(ruta));
  if (token && esApiPropia(req.url) && !esRutaSesion && !req.headers.has('Authorization')) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
  return next(req);
};
