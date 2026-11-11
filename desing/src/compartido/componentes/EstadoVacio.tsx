import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";

/** Estado vacío / sin coincidencias / error de una colección o gráfico. */
export function EstadoVacio({ titulo, texto, accion }: { titulo: string; texto: string; accion?: React.ReactNode }) {
  return (
    <Box textAlign="center" color="inherit" padding={{ vertical: "l" }}>
      <SpaceBetween size="m">
        <div>
          <Box variant="strong" color="inherit">
            {titulo}
          </Box>
          <Box variant="p" color="inherit">
            {texto}
          </Box>
        </div>
        {accion}
      </SpaceBetween>
    </Box>
  );
}
