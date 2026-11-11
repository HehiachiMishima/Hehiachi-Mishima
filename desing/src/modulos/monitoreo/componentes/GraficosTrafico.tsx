import BarChart from "@cloudscape-design/components/bar-chart";
import Container from "@cloudscape-design/components/container";
import Grid from "@cloudscape-design/components/grid";
import Header from "@cloudscape-design/components/header";
import LineChart from "@cloudscape-design/components/line-chart";
import { EstadoVacio } from "@/compartido/componentes/EstadoVacio";
import { hora } from "@/compartido/util/formato";
import type { PuntoMonitoreo } from "../tipos";

type Estado = "loading" | "finished" | "error";

/** Peticiones por minuto (apiladas por resultado) y latencia p95 de la última hora. */
export function GraficosTrafico({ serie, estado, onReintentar }: { serie: PuntoMonitoreo[]; estado: Estado; onReintentar: () => void }) {
  const etiquetas = serie.map((p) => hora(p.minuto));
  const vacio = <EstadoVacio titulo="Sin datos" texto="Aún no hay tráfico registrado." />;
  const comunes = { height: 200, hideFilter: true, xTitle: "Hora", statusType: estado, empty: vacio, onRecoveryClick: onReintentar } as const;

  return (
    <Grid gridDefinition={[{ colspan: { default: 12, m: 6 } }, { colspan: { default: 12, m: 6 } }]}>
      <Container header={<Header variant="h2" description="Correctas, rechazadas (4xx) y errores del servidor (5xx)">Peticiones por minuto</Header>}>
        <BarChart
          {...comunes}
          stackedBars
          xScaleType="categorical"
          yTitle="Peticiones"
          ariaLabel="Peticiones por minuto en la última hora"
          series={[
            { title: "Correctas", type: "bar", data: serie.map((p, i) => ({ x: etiquetas[i], y: p.peticiones - p.errores4xx - p.errores5xx })) },
            { title: "4xx", type: "bar", data: serie.map((p, i) => ({ x: etiquetas[i], y: p.errores4xx })) },
            { title: "5xx", type: "bar", data: serie.map((p, i) => ({ x: etiquetas[i], y: p.errores5xx })) },
          ]}
        />
      </Container>
      <Container header={<Header variant="h2" description="El 95 % de las peticiones respondió en menos de este tiempo">Latencia p95</Header>}>
        <LineChart
          {...comunes}
          xScaleType="time"
          yTitle="ms"
          xTickFormatter={(d) => hora(d)}
          ariaLabel="Latencia p95 por minuto en la última hora"
          series={[{ title: "p95", type: "line", data: serie.map((p) => ({ x: new Date(p.minuto), y: p.p95Ms })) }]}
        />
      </Container>
    </Grid>
  );
}
