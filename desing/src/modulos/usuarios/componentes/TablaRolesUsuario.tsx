import { useCollection } from "@cloudscape-design/collection-hooks";
import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import Toggle from "@cloudscape-design/components/toggle";
import { EstadoVacio } from "@/compartido/componentes/EstadoVacio";
import type { Rol } from "../tipos";

/** Roles del catálogo con un interruptor para asignar/quitar (cambio inmediato, auditado). */
export function TablaRolesUsuario({
  catalogo,
  asignados,
  cargando,
  cambiando,
  bloqueo,
  puedeAsignar,
  onAlternar,
}: {
  catalogo: Rol[];
  asignados: Set<number>;
  cargando: boolean;
  cambiando: number | null;
  bloqueo: string | undefined;
  puedeAsignar: boolean;
  onAlternar: (rol: Rol, asignar: boolean) => void;
}) {
  // Orden estable (alfabético): la fila no se mueve bajo el cursor al cambiar su interruptor.
  const filas = [...catalogo].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const { items, filterProps, filteredItemsCount, collectionProps } = useCollection(filas, {
    filtering: { fields: ["nombre", "descripcion"], noMatch: <EstadoVacio titulo="Sin coincidencias" texto="Ningún rol coincide." /> },
  });
  return (
    <Table
      {...collectionProps}
      variant="borderless"
      items={items}
      trackBy="id"
      loading={cargando}
      loadingText="Cargando roles"
      ariaLabels={{ tableLabel: "Roles del usuario" }}
      header={
        <Header variant="h3" counter={`(${asignados.size} de ${catalogo.length})`} description={bloqueo ?? (puedeAsignar ? "Los cambios se aplican al instante y quedan en la auditoría." : "Necesitas el permiso de asignar roles para cambiarlos.")}>
          Roles asignados
        </Header>
      }
      filter={<TextFilter {...filterProps} filteringPlaceholder="Buscar rol" filteringAriaLabel="Filtrar roles" countText={`${filteredItemsCount ?? 0} roles`} />}
      empty={<EstadoVacio titulo="Sin roles" texto="No hay roles en el catálogo." />}
      columnDefinitions={[
        {
          id: "asignado",
          header: "Asignado",
          width: 120,
          cell: (r) => (
            <Toggle
              checked={asignados.has(r.id)}
              disabled={!puedeAsignar || !!bloqueo || cambiando !== null}
              onChange={({ detail }) => onAlternar(r, detail.checked)}
              ariaLabel={`Asignar el rol ${r.nombre}`}
            />
          ),
        },
        {
          id: "rol",
          header: "Rol",
          isRowHeader: true,
          cell: (r) => (
            <SpaceBetween direction="horizontal" size="xs">
              <Box fontWeight="bold">{r.nombre}</Box>
              {cambiando === r.id && <StatusIndicator type="loading">Guardando</StatusIndicator>}
              {!r.activo && <Badge>Inactivo</Badge>}
            </SpaceBetween>
          ),
        },
        { id: "descripcion", header: "Descripción", cell: (r) => r.descripcion || "—" },
      ]}
    />
  );
}
