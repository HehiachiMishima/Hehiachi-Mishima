import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import { EstadoVacio } from "@/compartido/componentes/EstadoVacio";
import { diaHora, login, numero } from "@/compartido/util/formato";
import type { PeticionTraza } from "../tipos";

/** Errores recientes (4xx y 5xx) o peticiones lentas (cada fila enlaza a su traza en Actividad). */
export function TablaIncidencias({
  peticiones,
  cargando,
  tipo,
  umbralMs,
  enlace,
}: {
  peticiones: PeticionTraza[];
  cargando: boolean;
  tipo: "errores" | "lentas";
  umbralMs: number;
  enlace: (p: PeticionTraza) => React.ReactNode;
}) {
  return (
    <Table
      variant="borderless"
      items={peticiones}
      trackBy={(p) => String(p.id ?? `${p.ocurridoEn}-${p.uri}`)}
      loading={cargando}
      loadingText="Cargando incidencias"
      ariaLabels={{ tableLabel: tipo === "errores" ? "Errores recientes" : "Peticiones lentas recientes" }}
      columnDefinitions={[
        { id: "fecha", header: "Fecha", cell: (p) => diaHora(p.ocurridoEn) },
        { id: "operacion", header: "Operación", cell: enlace, isRowHeader: true },
        {
          id: "resultado",
          header: tipo === "errores" ? "Estado" : "Duración",
          cell: (p) =>
            tipo === "errores" ? <StatusIndicator type={p.estado >= 500 ? "error" : "warning"}>{String(p.estado)}</StatusIndicator> : <StatusIndicator type="warning">{`${numero(p.duracionMs)} ms`}</StatusIndicator>,
        },
        { id: "usuario", header: "Usuario", cell: (p) => (p.actorId ? login(p.actorUsuario ?? `#${p.actorId}`) : "Anónimo") },
        { id: "ip", header: "IP", cell: (p) => p.ip ?? "—" },
      ]}
      empty={
        tipo === "errores" ? (
          <EstadoVacio titulo="Sin errores recientes" texto="No hubo respuestas con error recientemente." />
        ) : (
          <EstadoVacio titulo="Sin peticiones lentas" texto={`Ninguna petición reciente superó ${numero(umbralMs)} ms.`} />
        )
      }
    />
  );
}
