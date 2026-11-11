/** Usuario autenticado tal como lo devuelve /auth/login y /auth/refresh. */
export interface UsuarioSesion {
  id: number;
  usuario: string;
  nombre: string;
  apellido: string;
  email: string;
}

export interface Sesion {
  token: string;
  tipo: string;
  /** Vencimiento del access token (ISO con zona). */
  expiraEn: string;
  usuario: UsuarioSesion;
  permisos: string[];
}

/** Por qué terminó una sesión (para avisarlo en el login). */
export type MotivoFin = "expirada" | "revocada" | "cerrada";
