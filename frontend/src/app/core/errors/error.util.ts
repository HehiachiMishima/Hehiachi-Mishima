import { HttpErrorResponse } from '@angular/common/http';

export interface CuerpoError {
  status?: number;
  error?: string;
  mensaje?: string;
  campos?: Record<string, string>;
}

export function cuerpoDeError(err: unknown): CuerpoError | null {
  if (err instanceof HttpErrorResponse && err.error && typeof err.error === 'object') {
    return err.error as CuerpoError;
  }
  return null;
}

export function mensajeDeError(err: unknown): string {
  const cuerpo = cuerpoDeError(err);
  if (cuerpo?.mensaje) {
    return cuerpo.mensaje;
  }
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
    }
    if (err.status >= 500) {
      return 'Ocurrió un error en el servidor. Inténtalo de nuevo.';
    }
    if (err.status === 403) {
      return 'No tienes permiso para realizar esta acción.';
    }
    if (err.status === 404) {
      return 'El recurso ya no existe. Actualiza la lista.';
    }
    return err.statusText || 'Ocurrió un error inesperado.';
  }
  return 'Ocurrió un error inesperado.';
}

/** Errores de validación por campo (`campos` del ApiError del backend). */
export function camposDeError(err: unknown): Record<string, string> {
  return cuerpoDeError(err)?.campos ?? {};
}

/** Identificador de la petición (cabecera X-Request-Id) para soporte técnico. */
export function idCorrelacionDe(err: unknown): string | null {
  return err instanceof HttpErrorResponse ? err.headers?.get('X-Request-Id') ?? null : null;
}

/** true si el backend respondió 403 (acceso denegado u operación no permitida). */
export function esAccesoDenegado(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 403;
}
