import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table, { type TableProps } from "@cloudscape-design/components/table";
import { EstadoVacio } from "@/compartido/componentes/EstadoVacio";
import { haceCuanto, numero } from "@/compartido/util/formato";
import type { Presencia } from "../tipos";

const columnas = (enlace: (p: Presencia) => React.ReactNode): TableProps.ColumnDefinition<Presencia>[] => [
  { id: "usuario", header: "Usuario", cell: enlace, isRowHeader: true },
  { id: "ultima", header: "Última actividad", cell: (p) => haceCuanto(p.ultimaVez) },
  { id: "ruta", header: "Última operación", cell: (p) => p.ultimaRuta ?? "—" },
  { id: "peticiones", header: "Peticiones", cell: (p) => numero(p.peticiones) },
  { id: "errores", header: "Errores", cell: (p) => (p.errores ? <StatusIndicator type="warning">{numero(p.errores)}</StatusIndicator> : "0") },
  { id: "ip", header: "IP", cell: (p) => p.ip ?? "—" },
];

export function TablaConectados({ presentes, cargando, enlace }: { presentes: Presencia[]; cargando: boolean; enlace: (p: Presencia) => React.ReactNode }) {
  return (
    <Table
      variant="borderless"
      items={presentes}
      columnDefinitions={columnas(enlace)}
      trackBy="actorId"
      loading={cargando}
      loadingText="Cargando usuarios conectados"
      ariaLabels={{ tableLabel: "Usuarios conectados" }}
      empty={<EstadoVacio titulo="Nadie conectado" texto="Nadie ha usado la API en los últimos 15 minutos." />}
    />
  );
}
