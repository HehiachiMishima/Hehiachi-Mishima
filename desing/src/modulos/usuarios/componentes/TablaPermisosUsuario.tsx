import { useState } from "react";
import { useCollection } from "@cloudscape-design/collection-hooks";
import Box from "@cloudscape-design/components/box";
import Header from "@cloudscape-design/components/header";
import Pagination from "@cloudscape-design/components/pagination";
import SegmentedControl from "@cloudscape-design/components/segmented-control";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import { EstadoVacio } from "@/compartido/componentes/EstadoVacio";
import type { FilaPermisoUsuario } from "../consultas";
import type { Ajuste } from "../tipos";

type Vista = "todos" | "permitidos" | "bloqueados" | "ajustes";

const AJUSTES: { id: Ajuste; text: string }[] = [
  { id: "heredar", text: "Heredar" },
  { id: "conceder", text: "Conceder" },
  { id: "denegar", text: "Denegar" },
];

/**
 * Permisos efectivos de un usuario con el porqué de cada uno y su ajuste individual:
 * heredar (de sus roles), conceder o denegar (la denegación siempre prevalece).
 */
export function TablaPermisosUsuario({
  filas,
  cargando,
  cambiando,
  bloqueo,
  puedeEditar,
  onAjuste,
}: {
  filas: FilaPermisoUsuario[];
  cargando: boolean;
  cambiando: number | null;
  bloqueo: string | undefined;
  puedeEditar: boolean;
  onAjuste: (f: FilaPermisoUsuario, a: Ajuste) => void;
}) {
  const [vista, setVista] = useState<Vista>("todos");
  const visibles = filas
    .filter((f) => vista === "todos" || (vista === "permitidos" && f.permitido) || (vista === "bloqueados" && !f.permitido) || (vista === "ajustes" && f.ajuste !== "heredar"))
    .map((f) => ({ ...f, id: f.permiso.id, nombre: f.permiso.nombre, descripcion: f.permiso.descripcion ?? "" }));
  const { items, filterProps, filteredItemsCount, collectionProps, paginationProps } = useCollection(visibles, {
    filtering: { fields: ["nombre", "descripcion"], noMatch: <EstadoVacio titulo="Sin coincidencias" texto="Ningún permiso coincide." />, empty: <EstadoVacio titulo="Sin permisos" texto="No hay permisos en esta vista." /> },
    pagination: { pageSize: 15 },
  });
  const permitidos = filas.filter((f) => f.permitido).length;
  const concedidos = filas.filter((f) => f.ajuste === "conceder").length;
  const denegados = filas.filter((f) => f.ajuste === "denegar").length;
  const editable = puedeEditar && !bloqueo;

  return (
    <Table
      {...collectionProps}
      variant="borderless"
      items={items}
      trackBy="id"
      loading={cargando}
      loadingText="Resolviendo permisos"
      wrapLines
      ariaLabels={{ tableLabel: "Permisos del usuario" }}
      header={
        <Header
          variant="h3"
          counter={`(${permitidos} permitidos)`}
          description={
            bloqueo ??
            (editable
              ? "Recibe los permisos de sus roles. Puedes conceder o denegar permisos concretos; una denegación siempre prevalece. Heredar quita el ajuste."
              : "Necesitas el permiso de asignar permisos para cambiar los ajustes individuales.")
          }
        >
          Permisos efectivos
        </Header>
      }
      filter={
        <SpaceBetween size="s">
          <SpaceBetween direction="horizontal" size="s" alignItems="center">
            <TextFilter {...filterProps} filteringPlaceholder="Buscar permiso" filteringAriaLabel="Filtrar permisos" countText={`${filteredItemsCount ?? 0} permisos`} />
            <SegmentedControl
              label="Mostrar"
              selectedId={vista}
              onChange={({ detail }) => setVista(detail.selectedId as Vista)}
              options={[
                { id: "todos", text: "Todos" },
                { id: "permitidos", text: "Permitidos" },
                { id: "bloqueados", text: "Sin acceso" },
                { id: "ajustes", text: "Con ajuste" },
              ]}
            />
          </SpaceBetween>
          <Box variant="small" color="text-body-secondary">{`${permitidos} permitidos · ${concedidos} concedidos individualmente · ${denegados} denegados individualmente`}</Box>
        </SpaceBetween>
      }
      pagination={<Pagination {...paginationProps} />}
      columnDefinitions={[
        {
          id: "permiso",
          header: "Permiso",
          isRowHeader: true,
          minWidth: 220,
          cell: (f) => (
            <SpaceBetween size="xxxs">
              <Box fontWeight="bold">{f.permiso.descripcion || f.permiso.nombre}</Box>
              <Box variant="code" fontSize="body-s">
                {f.permiso.nombre}
              </Box>
            </SpaceBetween>
          ),
        },
        {
          id: "resultado",
          header: "Resultado",
          width: 140,
          cell: (f) => (cambiando === f.permiso.id ? <StatusIndicator type="loading">Guardando</StatusIndicator> : <StatusIndicator type={f.permitido ? "success" : "stopped"}>{f.permitido ? "Permitido" : "Sin acceso"}</StatusIndicator>),
        },
        { id: "porque", header: "Por qué", cell: (f) => f.porque, minWidth: 260 },
        {
          id: "ajuste",
          header: "Ajuste individual",
          width: 290,
          cell: (f) =>
            editable ? (
              <SegmentedControl
                label={`Ajuste de ${f.permiso.nombre}`}
                selectedId={f.ajuste}
                options={AJUSTES.map((a) => ({ ...a, disabled: cambiando !== null }))}
                onChange={({ detail }) => onAjuste(f, detail.selectedId as Ajuste)}
              />
            ) : (
              AJUSTES.find((a) => a.id === f.ajuste)?.text
            ),
        },
      ]}
    />
  );
}
