import Box from "@cloudscape-design/components/box";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import { numero } from "@/compartido/util/formato";
import type { ResumenMonitoreo } from "../tipos";

interface Indicador {
  titulo: string;
  valor: string;
  detalle: string;
}

function indicadores(r: ResumenMonitoreo | undefined): Indicador[] {
  const v = r?.ventana;
  const sin = (titulo: string): Indicador => ({ titulo, valor: "—", detalle: "" });
  if (!r || !v) return ["Peticiones", "Errores del servidor (5xx)", "Rechazadas (4xx)", "Latencia p95", "Más lenta", "Usuarios activos"].map(sin);
  return [
    { titulo: "Peticiones", valor: numero(v.peticiones), detalle: `${numero(v.porMinuto)} por minuto` },
    { titulo: "Errores del servidor (5xx)", valor: `${numero(v.tasaError5xx)} %`, detalle: `${numero(v.errores5xx)} de ${numero(v.peticiones)}` },
    { titulo: "Rechazadas (4xx)", valor: numero(v.errores4xx), detalle: "Validación, permisos o sesión" },
    { titulo: "Latencia p95", valor: `${numero(v.p95Ms)} ms`, detalle: `p50 ${numero(v.p50Ms)} · p99 ${numero(v.p99Ms)} ms` },
    { titulo: "Más lenta", valor: `${numero(v.maxMs)} ms`, detalle: `Promedio ${numero(v.promedioMs)} ms` },
    { titulo: "Usuarios activos", valor: numero(r.usuariosActivos), detalle: `${r.sistema.enVuelo} peticiones en curso` },
  ];
}

export function IndicadoresTrafico({ resumen, minutos }: { resumen: ResumenMonitoreo | undefined; minutos: number }) {
  return (
    <Container fitHeight header={<Header variant="h2">{`Tráfico · últimos ${minutos} min`}</Header>}>
      <ColumnLayout columns={3} variant="text-grid" minColumnWidth={160}>
        {indicadores(resumen).map((i) => (
          <div key={i.titulo}>
            <Box variant="awsui-key-label">{i.titulo}</Box>
            <Box variant="awsui-value-large" display="block">
              {i.valor}
            </Box>
            <Box variant="small" color="text-body-secondary" display="block">
              {i.detalle}
            </Box>
          </div>
        ))}
      </ColumnLayout>
    </Container>
  );
}
