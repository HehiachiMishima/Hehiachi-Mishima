import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import ProgressBar from "@cloudscape-design/components/progress-bar";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { bytes, duracion, numero, porcentaje } from "@/compartido/util/formato";
import type { Sistema } from "../tipos";

/** Umbral a partir del cual la latencia de la BD se marca como lenta (igual que el backend). */
const BD_LENTA_MS = 500;

export function Infraestructura({ sistema }: { sistema: Sistema | undefined }) {
  return (
    <Container header={<Header variant="h2">Infraestructura</Header>}>
      {sistema ? (
        <KeyValuePairs
          columns={3}
          items={[
            {
              label: "Base de datos",
              value: sistema.baseDatos.disponible ? (
                <StatusIndicator type={(sistema.baseDatos.latenciaMs ?? 0) >= BD_LENTA_MS ? "warning" : "success"}>
                  {`${numero(sistema.baseDatos.latenciaMs ?? 0)} ms`}
                </StatusIndicator>
              ) : (
                <StatusIndicator type="error">Sin respuesta</StatusIndicator>
              ),
            },
            {
              label: "Pool de conexiones",
              value: sistema.baseDatos.poolMaximo ? (
                <ProgressBar
                  value={porcentaje(sistema.baseDatos.poolActivas ?? 0, sistema.baseDatos.poolMaximo)}
                  ariaLabel="Uso del pool de conexiones"
                  description={`${sistema.baseDatos.poolActivas ?? 0} de ${sistema.baseDatos.poolMaximo} en uso · ${sistema.baseDatos.poolEsperando ?? 0} en espera`}
                />
              ) : (
                "—"
              ),
            },
            {
              label: "Memoria (heap)",
              value: (
                <ProgressBar
                  value={porcentaje(sistema.jvm.heapUsadoBytes, sistema.jvm.heapMaxBytes)}
                  ariaLabel="Uso de memoria"
                  description={`${bytes(sistema.jvm.heapUsadoBytes)} de ${bytes(sistema.jvm.heapMaxBytes)}`}
                />
              ),
            },
            {
              label: "CPU del proceso",
              value: sistema.jvm.cpuProceso < 0 ? "No disponible" : `${numero(sistema.jvm.cpuProceso)} % · ${sistema.jvm.procesadores} núcleos`,
            },
            { label: "Hilos", value: numero(sistema.jvm.hilos) },
            { label: "En marcha", value: duracion(sistema.uptimeSegundos) },
            {
              label: "Escritura de bitácoras",
              value:
                sistema.colas.auditoriaDescartados > 0 ? (
                  <StatusIndicator type="error">{`${sistema.colas.auditoriaDescartados} eventos perdidos`}</StatusIndicator>
                ) : (
                  `${numero(sistema.colas.auditoriaPendientes + sistema.colas.trazasPendientes)} pendientes · traza ${sistema.colas.retencionDias} días`
                ),
            },
          ]}
        />
      ) : (
        <StatusIndicator type="loading">Cargando</StatusIndicator>
      )}
    </Container>
  );
}
