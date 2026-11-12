import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { Indicador } from "@/compartido/componentes/Indicador";
import { numero } from "@/compartido/util/formato";
import type { ResumenMonitoreo } from "../tipos";

/** p95 a partir del cual se considera lenta (umbral del backend). */
const LENTO_MS = 1000;

/** Cifras de la ventana, cada una con su semáforo (icono + texto, no solo color). */
export function IndicadoresTrafico({ resumen, minutos }: { resumen: ResumenMonitoreo | undefined; minutos: number }) {
  const v = resumen?.ventana;
  return (
    <Container fitHeight header={<Header variant="h2">{`Tráfico · últimos ${minutos} min`}</Header>}>
      <ColumnLayout columns={3} variant="text-grid" minColumnWidth={160}>
        <Indicador titulo="Peticiones" valor={v ? numero(v.peticiones) : "—"} detalle={v && `${numero(v.porMinuto)} por minuto`} />
        <Indicador
          titulo="Errores del servidor (5xx)"
          valor={v ? `${numero(v.tasaError5xx)} %` : "—"}
          detalle={v && `${numero(v.errores5xx)} de ${numero(v.peticiones)}`}
          estado={v && (v.errores5xx ? <StatusIndicator type="error">Hay fallos</StatusIndicator> : <StatusIndicator type="success">Sin fallos</StatusIndicator>)}
        />
        <Indicador
          titulo="Rechazadas (4xx)"
          valor={v ? numero(v.errores4xx) : "—"}
          detalle="Validación, permisos o sesión"
          estado={v && (v.errores4xx ? <StatusIndicator type="warning">Revisar</StatusIndicator> : <StatusIndicator type="success">Ninguna</StatusIndicator>)}
        />
        <Indicador
          titulo="Latencia p95"
          valor={v ? `${numero(v.p95Ms)} ms` : "—"}
          detalle={v && `p50 ${numero(v.p50Ms)} · p99 ${numero(v.p99Ms)} ms`}
          estado={v && (v.p95Ms >= LENTO_MS ? <StatusIndicator type="warning">Lenta</StatusIndicator> : <StatusIndicator type="success">Rápida</StatusIndicator>)}
        />
        <Indicador
          titulo="Más lenta"
          valor={v ? `${numero(v.maxMs)} ms` : "—"}
          detalle={v && `Promedio ${numero(v.promedioMs)} ms`}
          estado={v && v.maxMs >= LENTO_MS ? <StatusIndicator type="warning">Supera 1 s</StatusIndicator> : undefined}
        />
        <Indicador
          titulo="Usuarios activos"
          valor={resumen ? numero(resumen.usuariosActivos) : "—"}
          detalle={resumen && `${resumen.sistema.enVuelo} peticiones en curso`}
          estado={resumen && <StatusIndicator type={resumen.usuariosActivos ? "success" : "stopped"}>{resumen.usuariosActivos ? "Con actividad" : "Sin actividad"}</StatusIndicator>}
        />
      </ColumnLayout>
    </Container>
  );
}
