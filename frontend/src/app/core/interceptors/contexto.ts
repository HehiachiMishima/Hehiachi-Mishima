import { HttpContextToken, HttpHeaders } from '@angular/common/http';

/** Marca una petición ya reintentada tras renovar la sesión (evita bucles 401 → refresh → 401). */
export const REINTENTADA = new HttpContextToken<boolean>(() => false);

/** Rutas de sesión: no llevan Bearer y su 401 no dispara renovación ni expulsión. */
export const RUTAS_SESION = ['/auth/login', '/auth/refresh', '/auth/logout'];

/**
 * Cabecera exigida por /auth/refresh y /auth/logout: al ser propia fuerza el
 * preflight CORS, así otro sitio no puede usar la cookie del refresh token.
 */
export const CABECERA_AJAX = new HttpHeaders({ 'X-Requested-With': 'XMLHttpRequest' });
