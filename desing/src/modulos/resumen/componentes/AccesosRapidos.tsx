import { useNavigate } from "react-router";
import ActionCard from "@cloudscape-design/components/action-card";
import Container from "@cloudscape-design/components/container";
import Grid from "@cloudscape-design/components/grid";
import Header from "@cloudscape-design/components/header";
import Icon, { type IconProps } from "@cloudscape-design/components/icon";

export interface Acceso {
  id: string;
  titulo: string;
  descripcion: string;
  href: string;
  icono: IconProps.Name;
}

/** Tarjetas de acción: toda la tarjeta lleva al módulo. */
export function AccesosRapidos({ accesos }: { accesos: Acceso[] }) {
  const navegar = useNavigate();
  return (
    <Container header={<Header variant="h2">Accesos rápidos</Header>}>
      <Grid gridDefinition={accesos.map(() => ({ colspan: { default: 12, xs: 6, m: 4 } }))}>
        {accesos.map((a) => (
          <ActionCard
            key={a.id}
            href={a.href}
            onFollow={(e) => (e.preventDefault(), navegar(a.href))}
            header={a.titulo}
            description={a.descripcion}
            icon={<Icon name={a.icono} variant="link" size="medium" />}
            iconVerticalAlignment="top"
            variant="embedded"
          />
        ))}
      </Grid>
    </Container>
  );
}
