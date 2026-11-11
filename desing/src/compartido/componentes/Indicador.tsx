import type { ReactNode } from "react";
import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";

/** Cifra clave de un tablero: etiqueta, valor grande, detalle y (opcional) estado y enlace. */
export function Indicador({ titulo, valor, detalle, estado, enlace }: { titulo: string; valor: ReactNode; detalle?: ReactNode; estado?: ReactNode; enlace?: ReactNode }) {
  return (
    <SpaceBetween size="xxs">
      <Box variant="awsui-key-label">{titulo}</Box>
      <Box variant="awsui-value-large" display="block">
        {valor}
      </Box>
      {detalle && (
        <Box variant="small" color="text-body-secondary" display="block">
          {detalle}
        </Box>
      )}
      {estado}
      {enlace}
    </SpaceBetween>
  );
}
