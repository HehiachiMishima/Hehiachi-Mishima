import Box from "@cloudscape-design/components/box";
import AreaChart from "@cloudscape-design/components/area-chart";
import PieChart from "@cloudscape-design/components/pie-chart";
import BarChart from "@cloudscape-design/components/bar-chart";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Grid from "@cloudscape-design/components/grid";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { Indicador } from "@/compartido/componentes/Indicador";
import { fechaHora, haceCuanto, numero, porcentaje } from "@/compartido/util/formato";
import type { ActividadUsuario } from "../tipos";

function Grafico({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <SpaceBetween size="xs">
      <Box variant="h3">{titulo}</Box>
      {children}
    </SpaceBetween>
  );
}

const DIA = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", timeZone: "UTC" });

/** Resumen de lo que hizo un usuario en el periodo: volumen, errores, desde dónde y qué endpoints. */
export function ResumenUsuario({
  nombre,
  actividad,
  cargando,
  onAuditoria,
  onCerrarSesiones,
}: {
  nombre: string;
  actividad: ActividadUsuario | undefined;
  cargando: boolean;
  onAuditoria?: () => void;
  onCerrarSesiones?: () => void;
}) {
  const a = actividad;
  const tasa = a ? porcentaje(a.errores, a.peticiones) : 0;
  const comun = { hideFilter: true, hideLegend: true, xScaleType: "categorical" as const, height: 220, statusType: cargando ? ("loading" as const) : ("finished" as const) };
  const graficos = a && a.peticiones > 0;

  return (
    <Container
      header={
        <Header
          variant="h2"
          description={a ? (a.dias === 1 ? "Últimas 24 horas" : `Últimos ${a.dias} días`) : undefined}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              {onAuditoria && <Button onClick={onAuditoria}>Cambios en auditoría</Button>}
              {onCerrarSesiones && <Button onClick={onCerrarSesiones}>Cerrar sesiones</Button>}
            </SpaceBetween>
          }
        >
          {`Resumen de ${nombre}`}
        </Header>
      }
    >
      {!a ? (
        <StatusIndicator type="loading">Cargando resumen del usuario</StatusIndicator>
      ) : (
        <SpaceBetween size="l">
          <ColumnLayout columns={4} variant="text-grid" minColumnWidth={150}>
            <Indicador titulo="Peticiones" valor={numero(a.peticiones)} />
            <Indicador
              titulo="Con error"
              valor={`${tasa} %`}
              detalle={`${numero(a.errores)} rechazadas o fallidas`}
              estado={tasa >= 10 ? <StatusIndicator type="warning">Revisar</StatusIndicator> : undefined}
            />
            <Indicador titulo="Última actividad" valor={a.ultima ? haceCuanto(a.ultima) : "—"} detalle={a.ultima ? fechaHora(a.ultima) : "Sin peticiones en el periodo"} />
            <Indicador
              titulo="Direcciones IP"
              valor={numero(a.ips.length)}
              detalle={a.ips[0] ? `${a.ips[0].etiqueta}${a.ips.length > 1 ? " y otras" : ""}` : undefined}
              estado={a.ips.length > 3 ? <StatusIndicator type="warning">Varias</StatusIndicator> : undefined}
            />
          </ColumnLayout>
          {graficos && (
            <Grid gridDefinition={[0, 1, 2, 3].map(() => ({ colspan: { default: 12, s: 6 } }))}>
              <Grafico titulo="Endpoints más usados">
                <BarChart {...comun} horizontalBars ariaLabel="Endpoints más usados" series={[{ title: "Peticiones", type: "bar", data: a.rutas.slice(0, 8).map((c) => ({ x: c.etiqueta, y: c.valor })) }]} />
              </Grafico>
              <Grafico titulo="Resultados">
                <PieChart
                  variant="donut"
                  size="small"
                  hideFilter
                  data={a.estados.map((c) => ({ title: c.etiqueta, value: c.valor }))}
                  innerMetricValue={`${100 - tasa} %`}
                  innerMetricDescription="sin error"
                  segmentDescription={(d, total) => `${numero(d.value)} · ${porcentaje(d.value, total)} %`}
                  ariaLabel="Resultados de las peticiones del usuario"
                />
              </Grafico>
              <Grafico titulo={`Peticiones por día (${a.zona})`}>
                {a.porDia.length > 1 ? (
                  <AreaChart
                    {...comun}
                    hideLegend
                    ariaLabel="Peticiones por día"
                    series={[{ title: "Peticiones", type: "area", data: a.porDia.map((c) => ({ x: DIA.format(new Date(`${c.etiqueta}T00:00:00Z`)), y: c.valor })) }]}
                  />
                ) : (
                  // Un área necesita al menos dos puntos: con un solo día, barra.
                  <BarChart {...comun} ariaLabel="Peticiones por día" series={[{ title: "Peticiones", type: "bar", data: a.porDia.map((c) => ({ x: DIA.format(new Date(`${c.etiqueta}T00:00:00Z`)), y: c.valor })) }]} />
                )}
              </Grafico>
              <Grafico titulo="Desde dónde se conecta">
                <BarChart {...comun} horizontalBars ariaLabel="Direcciones IP del usuario" series={[{ title: "Peticiones", type: "bar", data: a.ips.slice(0, 8).map((c) => ({ x: c.etiqueta, y: c.valor })) }]} />
              </Grafico>
            </Grid>
          )}
        </SpaceBetween>
      )}
    </Container>
  );
}
