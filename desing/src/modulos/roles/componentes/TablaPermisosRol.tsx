import { useState } from "react";
import { useCollection } from "@cloudscape-design/collection-hooks";
import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import Header from "@cloudscape-design/components/header";
import Pagination from "@cloudscape-design/components/pagination";
import SegmentedControl from "@cloudscape-design/components/segmented-control";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import Toggle from "@cloudscape-design/components/toggle";
import { EstadoVacio } from "@/compartido/componentes/EstadoVacio";
import type { Permiso } from "../tipos";

/** Catálogo de permisos con un interruptor por permiso: concedido o no por este rol. */
export function TablaPermisosRol({
  catalogo,
  asignados,
  cargando,
  cambiando,
  puedeAsignar,
  protegido,
  usuarios,
  onAlternar,
}: {
  catalogo: Permiso[];
  asignados: Set<number>;
  cargando: boolean;
  cambiando: number | null;
  puedeAsignar: boolean;
  protegido: boolean;
  usuarios: number | undefined;
  onAlternar: (p: Permiso, asignar: boolean) => void;
}) {
  const [solo, setSolo] = useState<"todos" | "concedidos">("todos");
  const filas = catalogo.filter((p) => solo === "todos" || asignados.has(p.id)).map((p) => ({ ...p, descripcionTexto: p.descripcion ?? "" }));
  const { items, filterProps, filteredItemsCount, collectionProps, paginationProps } = useCollection(filas, {
    filtering: { fields: ["nombre", "descripcionTexto"], noMatch: <EstadoVacio titulo="Sin coincidencias" texto="Ningún permiso coincide." />, empty: <EstadoVacio titulo="Sin permisos" texto="Este rol no concede ningún permiso." /> },
    sorting: { defaultState: { sortingColumn: { sortingField: "nombre" } } },
    pagination: { pageSize: 20 },
  });
  const alcance = usuarios === undefined ? "a todos los usuarios con este rol" : usuarios === 1 ? "a 1 usuario con este rol" : `a ${usuarios} usuarios con este rol`;

  return (
    <Table
      {...collectionProps}
      variant="borderless"
      items={items}
      trackBy="id"
      loading={cargando}
      loadingText="Cargando permisos"
      ariaLabels={{ tableLabel: "Permisos del rol" }}
      header={
        <Header
          variant="h3"
          counter={`(${asignados.size} de ${catalogo.length})`}
          description={puedeAsignar ? `Los cambios se aplican al instante ${alcance}.${protegido ? " Rol protegido: solo se le pueden agregar permisos." : ""}` : "Necesitas el permiso de asignar permisos para cambiarlos."}
        >
          Permisos concedidos
        </Header>
      }
      filter={
        <SpaceBetween direction="horizontal" size="s" alignItems="center">
          <TextFilter {...filterProps} filteringPlaceholder="Buscar permiso" filteringAriaLabel="Filtrar permisos" countText={`${filteredItemsCount ?? 0} permisos`} />
          <SegmentedControl
            label="Mostrar"
            selectedId={solo}
            onChange={({ detail }) => setSolo(detail.selectedId as "todos" | "concedidos")}
            options={[
              { id: "todos", text: "Todo el catálogo" },
              { id: "concedidos", text: "Solo concedidos" },
            ]}
          />
        </SpaceBetween>
      }
      pagination={<Pagination {...paginationProps} />}
      columnDefinitions={[
        {
          id: "concedido",
          header: "Concedido",
          width: 120,
          cell: (p) => {
            const bloqueado = protegido && asignados.has(p.id);
            return (
              <Toggle
                checked={asignados.has(p.id)}
                disabled={!puedeAsignar || bloqueado || cambiando !== null}
                onChange={({ detail }) => onAlternar(p, detail.checked)}
                ariaLabel={`Conceder ${p.descripcion || p.nombre}`}
              />
            );
          },
        },
        {
          id: "nombre",
          header: "Permiso",
          isRowHeader: true,
          sortingField: "nombre",
          cell: (p) => (
            <SpaceBetween size="xxxs">
              <SpaceBetween direction="horizontal" size="xs">
                <Box fontWeight="bold">{p.descripcion || p.nombre}</Box>
                {!p.activo && <Badge>Inactivo</Badge>}
                {cambiando === p.id && <StatusIndicator type="loading">Guardando</StatusIndicator>}
              </SpaceBetween>
              <Box variant="code" fontSize="body-s">
                {p.nombre}
              </Box>
            </SpaceBetween>
          ),
        },
      ]}
    />
  );
}
