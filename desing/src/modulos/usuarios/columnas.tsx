import type { CollectionPreferencesProps } from "@cloudscape-design/components/collection-preferences";
import type { PropertyFilterProps } from "@cloudscape-design/components/property-filter";
import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import type { TableProps } from "@cloudscape-design/components/table";
import { fechaHora, haceCuanto } from "@/compartido/util/formato";
import type { Usuario, UsuarioResumen } from "./tipos";

/** Fila de la tabla: campos derivados para poder filtrar y ordenar por ellos. */
export type FilaUsuario = Usuario & {
  estado: "Activo" | "Inactivo";
  nombreCompleto: string;
  /** null si el resumen de accesos no está disponible. */
  roles: string[] | null;
  rolesTexto: string;
  sinRol: "Sí" | "No";
  permisos: number | null;
  ultimoCambio: string;
};

export function aFila(u: Usuario, resumen: Map<number, UsuarioResumen> | null): FilaUsuario {
  const r = resumen?.get(u.id);
  const roles = resumen ? (r?.roles ?? []) : null;
  return {
    ...u,
    estado: u.activo ? "Activo" : "Inactivo",
    nombreCompleto: `${u.nombre} ${u.apellido}`,
    roles,
    rolesTexto: roles?.join(", ") ?? "",
    sinRol: roles && roles.length === 0 ? "Sí" : "No",
    permisos: resumen ? (r?.permisos.length ?? 0) : null,
    ultimoCambio: u.actualizadoEn ?? u.creadoEn,
  };
}

export function columnas(enlace: (u: FilaUsuario) => React.ReactNode): TableProps.ColumnDefinition<FilaUsuario>[] {
  return [
    { id: "usuario", header: "Usuario", cell: enlace, sortingField: "usuario", isRowHeader: true, minWidth: 140 },
    { id: "nombre", header: "Nombre", cell: (u) => u.nombreCompleto, sortingField: "nombreCompleto", minWidth: 180 },
    { id: "email", header: "Correo", cell: (u) => u.email, sortingField: "email" },
    {
      id: "estado",
      header: "Estado",
      sortingField: "estado",
      cell: (u) => (
        <SpaceBetween direction="horizontal" size="xs">
          <StatusIndicator type={u.activo ? "success" : "stopped"}>{u.estado}</StatusIndicator>
        </SpaceBetween>
      ),
    },
    {
      id: "roles",
      header: "Roles",
      sortingField: "rolesTexto",
      cell: (u) =>
        u.roles === null ? (
          <Box color="text-body-secondary">No disponible</Box>
        ) : u.roles.length === 0 ? (
          <StatusIndicator type="warning">Sin rol</StatusIndicator>
        ) : (
          <SpaceBetween direction="horizontal" size="xxs">
            {u.roles.slice(0, 2).map((r) => (
              <Badge key={r} color="blue">
                {r}
              </Badge>
            ))}
            {u.roles.length > 2 && <Badge>{`+${u.roles.length - 2}`}</Badge>}
          </SpaceBetween>
        ),
    },
    { id: "permisos", header: "Permisos", cell: (u) => u.permisos ?? "—", sortingField: "permisos" },
    { id: "telefono", header: "Teléfono", cell: (u) => u.telefono || "—" },
    { id: "cambio", header: "Último cambio", cell: (u) => <span title={fechaHora(u.ultimoCambio)}>{haceCuanto(u.ultimoCambio)}</span>, sortingField: "ultimoCambio" },
  ];
}

export const PROPIEDADES_FILTRO: PropertyFilterProps.FilteringProperty[] = [
  { key: "usuario", propertyLabel: "Usuario", groupValuesLabel: "Usuarios", operators: [":", "!:", "="] },
  { key: "nombreCompleto", propertyLabel: "Nombre", groupValuesLabel: "Nombres", operators: [":", "!:"] },
  { key: "email", propertyLabel: "Correo", groupValuesLabel: "Correos", operators: [":", "!:", "="] },
  { key: "estado", propertyLabel: "Estado", groupValuesLabel: "Estados", operators: ["=", "!="] },
  { key: "rolesTexto", propertyLabel: "Rol", groupValuesLabel: "Roles", operators: [":", "!:"] },
  { key: "sinRol", propertyLabel: "Sin rol", groupValuesLabel: "Sin rol", operators: ["="] },
];

export const PREFERENCIAS_INICIALES: CollectionPreferencesProps.Preferences = {
  pageSize: 20,
  wrapLines: false,
  stripedRows: false,
  stickyColumns: { first: 1, last: 0 },
  contentDisplay: ["usuario", "nombre", "email", "estado", "roles", "permisos", "telefono", "cambio"].map((id) => ({ id, visible: id !== "telefono" })),
};
