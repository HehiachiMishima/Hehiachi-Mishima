import { useCollection } from "@cloudscape-design/collection-hooks";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import Grid from "@cloudscape-design/components/grid";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Pagination from "@cloudscape-design/components/pagination";
import SegmentedControl from "@cloudscape-design/components/segmented-control";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import { useState } from "react";
import { EstadoVacio } from "@/compartido/componentes/EstadoVacio";
import { useDirectorioUsuarios } from "@/compartido/datos/directorio";
import { useSeguirEnlace } from "@/compartido/navegacion";
import { fechaHora, haceCuanto, login } from "@/compartido/util/formato";
import { mensajeDeError } from "@/core/api/errores";
import { PERMISOS } from "@/core/sesion/permisos";
import { useSesion } from "@/core/sesion/useSesion";
import { useAccionesPermiso } from "../acciones";
import { usePermisos } from "../consultas";
import type { Permiso } from "../tipos";
import { InfoAyuda } from "@/compartido/marco/InfoAyuda";

type Estado = "todos" | "activos" | "inactivos";

export function ListaPermisos() {
  const { puede } = useSesion();
  const seguir = useSeguirEnlace();
  const consulta = usePermisos();
  const directorio = useDirectorioUsuarios();
  const acciones = useAccionesPermiso();
  const [estado, setEstado] = useState<Estado>("todos");

  const filas = (consulta.data ?? [])
    .filter((r) => estado === "todos" || (estado === "activos") === r.activo)
    .map((r) => ({ ...r, cambio: r.actualizadoEn ?? r.creadoEn, descripcionTexto: r.descripcion ?? "" }));
  const { items, collectionProps, filterProps, filteredItemsCount, paginationProps, actions } = useCollection(filas, {
    filtering: {
      fields: ["nombre", "descripcionTexto"],
      empty: consulta.isError ? (
        <EstadoVacio titulo="No se pudieron cargar los permisos" texto={mensajeDeError(consulta.error)} accion={<Button onClick={() => void consulta.refetch()}>Reintentar</Button>} />
      ) : (
        <EstadoVacio titulo="Sin permisos" texto="Crea el primer permiso del catálogo." accion={puede(PERMISOS.CREAR_PERMISOS) ? <Button onClick={acciones.crear}>Crear permiso</Button> : undefined} />
      ),
      // oxlint-disable-next-line react/immutability
      noMatch: <EstadoVacio titulo="Sin coincidencias" texto="Ningún permiso coincide con el filtro." accion={<Button onClick={() => (actions.setFiltering(""), setEstado("todos"))}>Borrar filtro</Button>} />,
    },
    sorting: { defaultState: { sortingColumn: { sortingField: "nombre" } } },
    pagination: { pageSize: 20 },
    selection: { trackBy: "id" },
  });
  const elegido = collectionProps.selectedItems?.[0] as Permiso | undefined;
  const por = (id: number | null) => (id === null ? "—" : id === 0 ? "Sistema" : login(directorio.porId.get(id)?.usuario ?? `#${id}`));

  return (
    <>
      <Table
        {...collectionProps}
        variant="full-page"
        stickyHeader
        resizableColumns
        selectionType="single"
        trackBy="id"
        items={items}
        loading={consulta.isPending}
        loadingText="Cargando permisos"
        ariaLabels={{ tableLabel: "Permisos", selectionGroupLabel: "Selección de permisos", itemSelectionLabel: (_, r) => `Seleccionar ${r.nombre}` }}
        header={
          <Header
            variant="awsui-h1-sticky"
            info={<InfoAyuda />}
            counter={consulta.data ? `(${consulta.data.length})` : undefined}
            description="Catálogo de permisos del sistema; se conceden mediante roles o ajustes individuales"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" ariaLabel="Actualizar" loading={consulta.isFetching} onClick={() => void consulta.refetch()} />
                <ButtonDropdown disabled={!elegido} disabledReason="Selecciona un permiso." items={elegido ? acciones.items(elegido) : []} onItemClick={({ detail }) => elegido && acciones.ejecutar(detail.id, elegido)}>
                  Acciones
                </ButtonDropdown>
                {puede(PERMISOS.CREAR_PERMISOS) && (
                  <Button variant="primary" onClick={acciones.crear}>
                    Crear permiso
                  </Button>
                )}
              </SpaceBetween>
            }
          >
            Permisos
          </Header>
        }
        filter={
          <Grid gridDefinition={[{ colspan: { default: 12, s: 7 } }, { colspan: { default: 12, s: 5 } }]}>
            <TextFilter {...filterProps} filteringPlaceholder="Buscar por código o descripción" filteringAriaLabel="Filtrar permisos" countText={`${filteredItemsCount ?? 0} coincidencias`} />
            <SegmentedControl
              label="Estado"
              selectedId={estado}
              onChange={({ detail }) => setEstado(detail.selectedId as Estado)}
              options={[
                { id: "todos", text: "Todos" },
                { id: "activos", text: "Activos" },
                { id: "inactivos", text: "Inactivos" },
              ]}
            />
          </Grid>
        }
        pagination={<Pagination {...paginationProps} />}
        columnDefinitions={[
          {
            id: "descripcion",
            header: "Permiso",
            isRowHeader: true,
            sortingField: "descripcionTexto",
            minWidth: 220,
            cell: (r) => (
              <Link href={`/permisos/${r.id}`} onFollow={seguir}>
                {r.descripcion || r.nombre}
              </Link>
            ),
          },
          { id: "nombre", header: "Código", sortingField: "nombre", cell: (r) => <Box variant="code">{r.nombre}</Box> },
          {
            id: "estado",
            header: "Estado",
            sortingField: "activo",
            cell: (r) => (
              <SpaceBetween direction="horizontal" size="xs">
                <StatusIndicator type={r.activo ? "success" : "stopped"}>{r.activo ? "Activo" : "Inactivo"}</StatusIndicator>
              </SpaceBetween>
            ),
          },
          { id: "cambio", header: "Último cambio", sortingField: "cambio", cell: (r) => <span title={fechaHora(r.cambio)}>{`${haceCuanto(r.cambio)} por ${por(r.actualizadoPor ?? r.creadoPor)}`}</span> },
        ]}
      />
      {acciones.modales}
    </>
  );
}
