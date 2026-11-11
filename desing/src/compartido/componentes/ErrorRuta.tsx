import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";

/**
 * Límite de errores de las rutas: un fallo al renderizar una página (o al descargar su
 * código tras un despliegue) no tumba la app entera; se ofrece recargar o volver.
 */
export function ErrorRuta() {
  const error = useRouteError();
  const navegar = useNavigate();
  const detalle = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : String(error);
  return (
    <Box padding="l">
      <Alert
        type="error"
        header="Esta página no se pudo mostrar"
        action={
          <Button onClick={() => window.location.reload()} iconName="refresh">
            Recargar
          </Button>
        }
      >
        Ocurrió un error inesperado. Puedes recargar o{" "}
        <Button variant="inline-link" onClick={() => navegar("/")}>
          volver al inicio
        </Button>
        .
        <Box variant="small" color="text-body-secondary" display="block" margin={{ top: "xs" }}>
          {detalle}
        </Box>
      </Alert>
    </Box>
  );
}
