import { QueryClient } from "@tanstack/react-query";
import { ErrorApi } from "./api/errores";

/**
 * Caché de datos del servidor (TanStack Query): deduplica peticiones, descarta respuestas
 * fuera de orden, reintenta errores transitorios y refresca al volver a la pestaña.
 */
export function crearClienteConsultas(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Un 4xx (validación, permisos) no mejora reintentando.
        retry: (intentos, e) => !(e instanceof ErrorApi && e.esDeCliente) && intentos < 2,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}
