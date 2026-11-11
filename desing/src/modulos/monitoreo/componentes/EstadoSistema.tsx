import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator, { type StatusIndicatorProps } from "@cloudscape-design/components/status-indicator";
import type { EstadoSistema as Estado, Sistema } from "../tipos";

const ESTADOS: Record<Estado, { tipo: StatusIndicatorProps.Type; texto: string; detalle: string }> = {
  OPERATIVO: { tipo: "success", texto: "Operativo", detalle: "La API, la base de datos y la aplicación responden con normalidad." },
  DEGRADADO: { tipo: "warning", texto: "Degradado", detalle: "El sistema responde, pero hay indicadores fuera de lo normal." },
  CAIDO: { tipo: "error", texto: "Caído", detalle: "La base de datos no responde: la mayoría de las operaciones fallarán." },
};

export function EstadoSistema({ sistema }: { sistema: Sistema | undefined }) {
  const e = sistema ? ESTADOS[sistema.estado] : null;
  return (
    <Container fitHeight header={<Header variant="h2">Estado del sistema</Header>}>
      {sistema && e ? (
        <SpaceBetween size="s">
          <StatusIndicator type={e.tipo}>{e.texto}</StatusIndicator>
          <Box variant="p" color="text-body-secondary">
            {e.detalle}
          </Box>
          {sistema.alertas.map((a) => (
            <Alert key={a} type="warning">
              {a}
            </Alert>
          ))}
        </SpaceBetween>
      ) : (
        <StatusIndicator type="loading">Cargando estado</StatusIndicator>
      )}
    </Container>
  );
}
