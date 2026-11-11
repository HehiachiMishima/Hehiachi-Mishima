import Badge, { type BadgeProps } from "@cloudscape-design/components/badge";
import { categoriaDe } from "@/compartido/auditoria/etiquetas";

/** Color por verbo HTTP: lectura azul, alta verde, cambio ámbar, borrado rojo. */
const COLOR_METODO: Record<string, BadgeProps["color"]> = {
  GET: "blue",
  POST: "green",
  PUT: "severity-medium",
  PATCH: "severity-low",
  DELETE: "red",
};

export function MetodoHttp({ metodo }: { metodo: string }) {
  return <Badge color={COLOR_METODO[metodo] ?? "grey"}>{metodo}</Badge>;
}

/** Color por categoría de la bitácora (sesión, usuarios, roles, permisos, asignaciones, seguridad). */
const COLOR_CATEGORIA: Record<string, BadgeProps["color"]> = {
  Sesión: "blue",
  Usuarios: "green",
  Roles: "severity-low",
  Permisos: "severity-medium",
  Asignaciones: "severity-high",
  Seguridad: "red",
};

export function CategoriaAccion({ accion }: { accion: string }) {
  const categoria = categoriaDe(accion);
  return <Badge color={COLOR_CATEGORIA[categoria] ?? "grey"}>{categoria}</Badge>;
}
