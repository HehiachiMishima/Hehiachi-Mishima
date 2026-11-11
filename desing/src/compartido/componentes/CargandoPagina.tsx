import Box from "@cloudscape-design/components/box";
import StatusIndicator from "@cloudscape-design/components/status-indicator";

export function CargandoPagina({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <Box textAlign="center" padding={{ vertical: "xxxl" }}>
      <StatusIndicator type="loading">{texto}</StatusIndicator>
    </Box>
  );
}
