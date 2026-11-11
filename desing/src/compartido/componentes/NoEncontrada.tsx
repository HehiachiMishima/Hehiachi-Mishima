import { useNavigate } from "react-router";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";

export function NoEncontrada() {
  const navegar = useNavigate();
  return (
    <ContentLayout header={<Header variant="h1">Página no encontrada</Header>}>
      <Container>
        <SpaceBetween size="m">
          <Box variant="p">La dirección no existe o cambió.</Box>
          <Button onClick={() => navegar("/")}>Ir al inicio</Button>
        </SpaceBetween>
      </Container>
    </ContentLayout>
  );
}
