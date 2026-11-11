/** Envoltorio de toda respuesta correcta de la API. */
export interface ApiResponse<T> {
  exito: boolean;
  mensaje: string;
  datos: T;
}

/** Cuerpo de error de la API (GlobalExceptionHandler del backend). */
export interface ApiErrorCuerpo {
  status: number;
  error: string;
  mensaje: string;
  campos?: Record<string, string> | null;
}

/** Página del servidor (pagina empieza en 1). */
export interface Pagina<T> {
  contenido: T[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}
