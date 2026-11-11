import StatusIndicator from "@cloudscape-design/components/status-indicator";

const TEXTO: Record<number, string> = { 400: "Datos no válidos", 401: "Sin sesión", 403: "Sin permiso", 404: "No encontrado", 409: "Conflicto", 429: "Demasiadas peticiones" };

/** Código HTTP con icono y texto: 2xx correcto, 4xx rechazado, 5xx error. */
export function EstadoHttp({ estado }: { estado: number }) {
  const tipo = estado >= 500 ? "error" : estado >= 400 ? "warning" : "success";
  return <StatusIndicator type={tipo}>{`${estado}${TEXTO[estado] ? ` · ${TEXTO[estado]}` : ""}`}</StatusIndicator>;
}
