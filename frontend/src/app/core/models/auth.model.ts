import { Usuario } from './usuario.model';

export interface LoginRequest {
  usuario: string;
  contrasena: string;
}

export interface AuthResponse {
  token: string;
  tipo: string;
  expiraEn: string;
  usuario: Usuario;
  permisos: string[];
}

export interface Sesion {
  token: string;
  tipo: string;
  expiraEn: string;
  usuario: Usuario;
  permisos: string[];
}

/** GET /auth/sesion: identidad y permisos vigentes ahora mismo. */
export interface SesionVigente {
  usuario: Usuario;
  permisos: string[];
}

export interface CambiarContrasenaRequest {
  contrasenaActual: string;
  contrasenaNueva: string;
}
