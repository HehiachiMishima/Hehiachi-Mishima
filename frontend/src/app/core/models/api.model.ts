export interface ApiResponse<T> {
  exito: boolean;
  mensaje: string;
  datos: T;
  timestamp: string;
}

/** Página de resultados del servidor (pagina es 1-based). */
export interface PaginaResponse<T> {
  contenido: T[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}
