import { useCollection } from "@cloudscape-design/collection-hooks";
import Pagination from "@cloudscape-design/components/pagination";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table, { type TableProps } from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import { EstadoVacio } from "@/compartido/componentes/EstadoVacio";
import { numero } from "@/compartido/util/formato";
import type { RutaMonitoreo } from "../tipos";

/** p95 a partir del cual el endpoint se marca como lento (umbral del backend). */
const LENTO_MS = 1000;

type Fila = RutaMonitoreo & { clave: string; errores: number };

const columnas = (enlace: (r: RutaMonitoreo) => React.ReactNode): TableProps.ColumnDefinition<Fila>[] => [
  { id: "endpoint", header: "Endpoint", cell: enlace, sortingField: "clave", isRowHeader: true, minWidth: 260 },
  { id: "peticiones", header: "Peticiones", cell: (r) => numero(r.peticiones), sortingField: "peticiones" },
  {
    id: "errores",
    header: "Errores",
    sortingField: "errores",
    cell: (r) =>
      r.errores5xx ? (
        <StatusIndicator type="error">{`${r.errores5xx} 5xx${r.errores4xx ? ` · ${r.errores4xx} 4xx` : ""}`}</StatusIndicator>
      ) : r.errores4xx ? (
        <StatusIndicator type="warning">{`${r.errores4xx} 4xx`}</StatusIndicator>
      ) : (
        <StatusIndicator type="success">0</StatusIndicator>
      ),
  },
  { id: "promedio", header: "Promedio", cell: (r) => `${numero(r.promedioMs)} ms`, sortingField: "promedioMs" },
  {
    id: "p95",
    header: "p95",
    sortingField: "p95Ms",
    cell: (r) => (r.p95Ms >= LENTO_MS ? <StatusIndicator type="warning">{`${numero(r.p95Ms)} ms`}</StatusIndicator> : `${numero(r.p95Ms)} ms`),
  },
  { id: "max", header: "Máx.", cell: (r) => `${numero(r.maxMs)} ms`, sortingField: "maxMs" },
];

/** Rendimiento por endpoint en la ventana elegida (ordenable y filtrable en cliente). */
export function TablaEndpoints({ rutas, cargando, enlace }: { rutas: RutaMonitoreo[]; cargando: boolean; enlace: (r: RutaMonitoreo) => React.ReactNode }) {
  const filas = rutas.map((r) => ({ ...r, clave: `${r.metodo} ${r.ruta}`, errores: r.errores4xx + r.errores5xx }));
  const COLUMNAS = columnas(enlace);
  const { items, collectionProps, paginationProps, filterProps, filteredItemsCount, actions } = useCollection(filas, {
    filtering: {
      fields: ["clave"],
      empty: <EstadoVacio titulo="Sin peticiones" texto="Aún no hay peticiones en este periodo." />,
      noMatch: <EstadoVacio titulo="Sin coincidencias" texto="Ningún endpoint coincide." />,
    },
    sorting: { defaultState: { sortingColumn: COLUMNAS[1], isDescending: true } },
    pagination: { pageSize: 10 },
  });
  return (
    <Table
      {...collectionProps}
      variant="borderless"
      items={items}
      columnDefinitions={COLUMNAS}
      trackBy="clave"
      loading={cargando}
      loadingText="Cargando endpoints"
      resizableColumns
      ariaLabels={{ tableLabel: "Endpoints" }}
      filter={
        <TextFilter
          {...filterProps}
          filteringPlaceholder="Buscar endpoint"
          filteringAriaLabel="Filtrar endpoints"
          countText={`${filteredItemsCount ?? 0} ${filteredItemsCount === 1 ? "coincidencia" : "coincidencias"}`}
          // oxlint-disable-next-line react/immutability
          onDelayedChange={() => actions.setCurrentPage(1)}
        />
      }
      pagination={rutas.length > 10 ? <Pagination {...paginationProps} /> : undefined}
    />
  );
}
