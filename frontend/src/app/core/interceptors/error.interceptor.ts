import { HttpErrorResponse, HttpEvent, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { mensajeDeError } from '../errors/error.util';
import { Auth } from '../services/auth';
import { Notificaciones } from '../services/notificaciones';
import { SesionStore } from '../services/sesion';
import { REINTENTADA, RUTAS_SESION } from './contexto';

/** Peticiones cuyo 401 es un error de credenciales o de la propia sesión, no un token vencido. */
const SIN_EXPULSION = [...RUTAS_SESION, '/auth/contrasena'];

/**
 * Avisos globales de errores HTTP. Solo notifica lo que el componente no
 * puede resolver (sin conexión, 5xx) y gestiona la sesión (401/403); los 4xx
 * los muestra cada pantalla junto al campo o la acción, para que cada error
 * genere un único aviso.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notificaciones = inject(Notificaciones);
  const sesionStore = inject(SesionStore);
  const auth = inject(Auth);
  const exento = SIN_EXPULSION.some((ruta) => req.url.includes(ruta));

  const manejar = (err: unknown, actual: HttpRequest<unknown>): Observable<HttpEvent<unknown>> => {
    if (!(err instanceof HttpErrorResponse)) {
      return throwError(() => err);
    }

    if (err.status === 401 && !exento) {
      // Un token aún dentro de su vigencia rechazado por el servidor = sesión revocada.
      const revocada = sesionStore.esVigente(sesionStore.sesion());
      if (!actual.context.get(REINTENTADA) && sesionStore.sesion() !== null) {
        // Access token vencido o revocado: se intenta renovar con el refresh token
        // (sin pedir contraseña) y se repite la petición UNA vez.
        return auth.renovar().pipe(
          switchMap((renovada) => {
            const token = sesionStore.sesion()?.token;
            if (!renovada || !token) {
              auth.expulsar(revocada ? 'revocada' : 'expirada');
              return throwError(() => err);
            }
            actual.context.set(REINTENTADA, true);
            const reintento = actual.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
            return next(reintento).pipe(catchError((e) => manejar(e, reintento)));
          }),
        );
      }
      auth.expulsar(revocada ? 'revocada' : 'expirada');
    } else if (err.status === 403) {
      // Puede que mis permisos hayan cambiado: releerlos para ocultar lo que ya no puedo hacer.
      auth.refrescarSesion().subscribe({ error: () => undefined });
    } else if (err.status === 0) {
      notificaciones.error('Sin conexión', mensajeDeError(err));
    } else if (err.status >= 500) {
      notificaciones.error('Error del servidor', mensajeDeError(err));
    }

    return throwError(() => err);
  };

  return next(req).pipe(catchError((err: unknown) => manejar(err, req)));
};

