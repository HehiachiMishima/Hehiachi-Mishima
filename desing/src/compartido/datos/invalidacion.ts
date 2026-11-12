import { useQueryClient, type Query } from "@tanstack/react-query";

/**
 * Usuarios, roles y permisos se afectan entre sí (asignar un permiso a un rol cambia los permisos
 * efectivos de sus usuarios y "qué roles lo conceden"; asignar un rol cambia los conteos del Resumen).
 * Tras cualquier cambio de gestión se refresca todo lo relacionado, no solo el módulo que lo hizo.
 */
const RELACIONADAS = ["usuarios", "roles", "permisos", "resumen", "directorio-usuarios", "historial", "actividad", "monitoreo"];

/**
 * `eliminado`: [módulo, id] de un elemento recién borrado; sus consultas propias (detalle, relaciones)
 * no se vuelven a pedir, así la página de detalle no muestra un 404 mientras navega a la lista.
 */
export function useInvalidarGestion() {
  const cliente = useQueryClient();
  return (eliminado?: [string, number]) => {
    const esDelEliminado = (q: Query) => !!eliminado && q.queryKey[0] === eliminado[0] && q.queryKey[2] === eliminado[1];
    // Las del eliminado quedan obsoletas pero no se piden ahora (la página que las usa está saliendo);
    // si se vuelve a ellas (botón Atrás) se piden de nuevo y muestran "no encontrado".
    void cliente.invalidateQueries({ predicate: esDelEliminado, refetchType: "none" });
    return cliente.invalidateQueries({ predicate: (q) => RELACIONADAS.includes(String(q.queryKey[0])) && !esDelEliminado(q) });
  };
}
