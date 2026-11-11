import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { Indicador } from "@/compartido/componentes/Indicador";
import { useSeguirEnlace } from "@/compartido/navegacion";
import { numero } from "@/compartido/util/formato";
import type { IndicadorSeguridad } from "../tipos";

export function IndicadoresSeguridad({ indicadores }: { indicadores: IndicadorSeguridad[] }) {
  const seguir = useSeguirEnlace();
  return (
    <Container fitHeight header={<Header variant="h2" description="Calculado a partir de la bitácora de auditoría">Seguridad</Header>}>
      <ColumnLayout columns={indicadores.length || 1} variant="text-grid" minColumnWidth={150}>
        {indicadores.map((i) => (
          <Indicador
            key={i.id}
            titulo={i.titulo}
            valor={i.valor === undefined ? <StatusIndicator type="loading">Cargando</StatusIndicator> : Number.isNaN(i.valor) ? "No disponible" : numero(i.valor)}
            estado={i.valor ? <StatusIndicator type="warning">Revisar</StatusIndicator> : undefined}
            enlace={
              <Link href={i.enlace} onFollow={seguir} variant="secondary">
                Ver en Auditoría
              </Link>
            }
          />
        ))}
      </ColumnLayout>
    </Container>
  );
}
