import { useCollection } from "@cloudscape-design/collection-hooks";
import Badge from "@cloudscape-design/components/badge";
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
import { fechaHora, haceCuanto, login, numero } from "@/compartido/util/formato";
import { mensajeDeError } from "@/core/api/errores";
import { PERMISOS } from "@/core/sesion/permisos";
import { useSesion } from "@/core/sesion/useSesion";
import { useAccionesRol } from "../acciones";
import { useConteoUsuarios, useRoles } from "../consultas";
import type { Rol } from "../tipos";

type Estado = "todos" | "activos" | "inactivos";

export function ListaRoles() {
  const { puede } = useSesion();
  const seguir = useSeguirEnlace();
  const consulta = useRoles();
  const conteo = useConteoUsuarios();
  const directorio = useDirectorioUsuarios();
  const acciones = useAccionesRol();
  const [estado, setEstado] = useState<Estado>("todos");

  const filas = (consulta.data ?? [])
    .filter((r) => estado === "todos" || (estado === "activos") === r.activo)
    .map((r) => ({ ...r, usuarios: conteo.data?.get(r.nombre) ?? null, cambio: r.actualizadoEn ?? r.creadoEn, descripcionTexto: r.descripcion ?? "" }));
  const { items, collectionProps, filterProps, filteredItemsCount, paginationProps, actions } = useCollection(filas, {
    filtering: {
      fields: ["nombre", "descripcionTexto"],
      empty: consulta.isError ? (
        <EstadoVacio titulo="No se pudieron cargar los roles" texto={mensajeDeError(consulta.error)} accion={<Button onClick={() => void consulta.refetch()}>Reintentar</Button>} />
      ) : (
        <EstadoVacio titulo="Sin roles" texto="Crea el primer rol para agrupar permisos." accion={puede(PERMISOS.CREAR_ROLES) ? <Button onClick={acciones.crear}>Crear rol</Button> : undefined} />
      ),
      // oxlint-disable-next-line react/immutability
      noMatch: <EstadoVacio titulo="Sin coincidencias" texto="Ningún rol coincide con el filtro." accion={<Button onClick={() => (actions.setFiltering(""), setEstado("todos"))}>Borrar filtro</Button>} />,
    },
    sorting: { defaultState: { sortingColumn: { sortingField: "nombre" } } },
    pagination: { pageSize: 20 },
    selection: { trackBy: "id" },
  });
  const elegido = collectionProps.selectedItems?.[0] as Rol | undefined;
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
        loadingText="Cargando roles"
        ariaLabels={{ tableLabel: "Roles", selectionGroupLabel: "Selección de roles", itemSelectionLabel: (_, r) => `Seleccionar ${r.nombre}` }}
        header={
          <Header
            variant="awsui-h1-sticky"
            counter={consulta.data ? `(${consulta.data.length})` : undefined}
            description="Roles y los permisos que conceden a sus usuarios"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" ariaLabel="Actualizar" loading={consulta.isFetching} onClick={() => void consulta.refetch()} />
                <ButtonDropdown disabled={!elegido} disabledReason="Selecciona un rol." items={elegido ? acciones.items(elegido) : []} onItemClick={({ detail }) => elegido && acciones.ejecutar(detail.id, elegido)}>
                  Acciones
                </ButtonDropdown>
                {puede(PERMISOS.CREAR_ROLES) && (
                  <Button variant="primary" onClick={acciones.crear}>
                    Crear rol
                  </Button>
                )}
              </SpaceBetween>
            }
          >
            Roles
          </Header>
        }
        filter={
          <Grid gridDefinition={[{ colspan: { default: 12, s: 7 } }, { colspan: { default: 12, s: 5 } }]}>
            <TextFilter {...filterProps} filteringPlaceholder="Buscar por nombre o descripción" filteringAriaLabel="Filtrar roles" countText={`${filteredItemsCount ?? 0} coincidencias`} />
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
            id: "nombre",
            header: "Rol",
            isRowHeader: true,
            sortingField: "nombre",
            cell: (r) => (
              <Link href={`/roles/${r.id}`} onFollow={seguir}>
                {r.nombre}
              </Link>
            ),
          },
          { id: "descripcion", header: "Descripción", cell: (r) => r.descripcion || <Box color="text-body-secondary">Sin descripción</Box>, minWidth: 220 },
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
          ...(conteo.data
            ? [{ id: "usuarios", header: "Usuarios", sortingField: "usuarios", cell: (r: (typeof filas)[number]) => (r.usuarios ? numero(r.usuarios) : <Box color="text-body-secondary">Sin usuarios</Box>) }]
            : []),
          { id: "cambio", header: "Último cambio", sortingField: "cambio", cell: (r) => <span title={fechaHora(r.cambio)}>{`${haceCuanto(r.cambio)} por ${por(r.actualizadoPor ?? r.creadoPor)}`}</span> },
        ]}
      />
      {acciones.modales}
    </>
  );
}
