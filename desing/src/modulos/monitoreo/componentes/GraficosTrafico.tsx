import BarChart from "@cloudscape-design/components/bar-chart";
import Container from "@cloudscape-design/components/container";
import Grid from "@cloudscape-design/components/grid";
import Header from "@cloudscape-design/components/header";
import MixedLineBarChart from "@cloudscape-design/components/mixed-line-bar-chart";
import PieChart from "@cloudscape-design/components/pie-chart";
import { EstadoVacio } from "@/compartido/componentes/EstadoVacio";
import { hora, numero, porcentaje } from "@/compartido/util/formato";
import type { PuntoMonitoreo, Ventana } from "../tipos";

type Estado = "loading" | "finished" | "error";

/** Umbral de lentitud que se dibuja sobre la latencia. */
const UMBRAL_MS = 1000;

/** Tendencias de la última hora (barras apiladas y latencia con umbral) y reparto de resultados de la ventana. */
export function GraficosTrafico({ serie, ventana, estado, onReintentar }: { serie: PuntoMonitoreo[]; ventana: Ventana | undefined; estado: Estado; onReintentar: () => void }) {
  const etiquetas = serie.map((p) => hora(p.minuto));
  const vacio = <EstadoVacio titulo="Sin datos" texto="Aún no hay tráfico registrado." />;
  const comunes = { height: 200, hideFilter: true, statusType: estado, empty: vacio, onRecoveryClick: onReintentar } as const;
  const resultados = ventana
    ? [
        { title: "Correctas", value: Math.max(0, ventana.peticiones - ventana.errores4xx - ventana.errores5xx) },
        { title: "Rechazadas (4xx)", value: ventana.errores4xx },
        { title: "Errores (5xx)", value: ventana.errores5xx },
      ].filter((d) => d.value > 0)
    : [];
  const col = { colspan: { default: 12, s: 4 } };

  return (
    <Grid gridDefinition={[col, col, col]}>
      <Container fitHeight header={<Header variant="h2" description="Correctas, rechazadas (4xx) y errores (5xx)">Peticiones por minuto</Header>}>
        <BarChart
          {...comunes}
          stackedBars
          xScaleType="categorical"
          xTitle="Hora"
          yTitle="Peticiones"
          ariaLabel="Peticiones por minuto en la última hora"
          series={[
            { title: "Correctas", type: "bar", data: serie.map((p, i) => ({ x: etiquetas[i], y: p.peticiones - p.errores4xx - p.errores5xx })) },
            { title: "4xx", type: "bar", data: serie.map((p, i) => ({ x: etiquetas[i], y: p.errores4xx })) },
            { title: "5xx", type: "bar", data: serie.map((p, i) => ({ x: etiquetas[i], y: p.errores5xx })) },
          ]}
        />
      </Container>
      <Container fitHeight header={<Header variant="h2" description={`p95 y promedio; la línea marca ${numero(UMBRAL_MS)} ms`}>Latencia</Header>}>
        <MixedLineBarChart
          {...comunes}
          xScaleType="categorical"
          xTitle="Hora"
          yTitle="ms"
          ariaLabel="Latencia por minuto en la última hora"
          series={[
            { title: "Promedio", type: "bar", data: serie.map((p, i) => ({ x: etiquetas[i], y: p.promedioMs })) },
            { title: "p95", type: "line", data: serie.map((p, i) => ({ x: etiquetas[i], y: p.p95Ms })) },
            { title: "Umbral de lentitud", type: "threshold", y: UMBRAL_MS },
          ]}
        />
      </Container>
      <Container fitHeight header={<Header variant="h2" description="Reparto de la ventana elegida">Resultados</Header>}>
        <PieChart
          variant="donut"
          size="medium"
          hideFilter
          statusType={ventana ? "finished" : estado}
          data={resultados}
          innerMetricValue={ventana ? `${porcentaje(ventana.peticiones - ventana.errores4xx - ventana.errores5xx, ventana.peticiones)} %` : undefined}
          innerMetricDescription="correctas"
          segmentDescription={(d, total) => `${numero(d.value)} · ${porcentaje(d.value, total)} %`}
          detailPopoverContent={(d, total) => [
            { key: "Peticiones", value: numero(d.value) },
            { key: "Proporción", value: `${porcentaje(d.value, total)} %` },
          ]}
          ariaLabel="Reparto de resultados"
          empty={vacio}
          onRecoveryClick={onReintentar}
        />
      </Container>
    </Grid>
  );
}
