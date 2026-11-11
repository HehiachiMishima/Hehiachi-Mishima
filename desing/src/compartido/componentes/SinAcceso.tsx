import { useNavigate } from "react-router";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { cerrarSesion } from "@/core/sesion/autenticacion";

/** Sin permiso para la página (o para ningún módulo de esta consola). */
export function SinAcceso({ sinModulos = false }: { sinModulos?: boolean }) {
  const navegar = useNavigate();
  return (
    <ContentLayout header={<Header variant="h1">Sin acceso</Header>}>
      <Container>
        <SpaceBetween size="m">
          <Box variant="p">
            {sinModulos
              ? "Tu cuenta no tiene permisos para ningún módulo de esta consola. Pide acceso a un administrador."
              : "No tienes permiso para ver esta página. Si lo necesitas, pide acceso a un administrador."}
          </Box>
          {sinModulos ? <Button onClick={() => cerrarSesion()}>Cerrar sesión</Button> : <Button onClick={() => navegar("/")}>Ir al inicio</Button>}
        </SpaceBetween>
      </Container>
    </ContentLayout>
  );
}
