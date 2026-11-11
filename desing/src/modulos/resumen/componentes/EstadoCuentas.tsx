import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import PieChart from "@cloudscape-design/components/pie-chart";
import { EstadoVacio } from "@/compartido/componentes/EstadoVacio";
import { numero, porcentaje } from "@/compartido/util/formato";
import type { KpisAdmin } from "../tipos";

/** Dona de cuentas activas e inactivas, con el total en el centro. */
export function EstadoCuentas({ kpis, estado, onReintentar }: { kpis: KpisAdmin | undefined; estado: "loading" | "finished" | "error"; onReintentar: () => void }) {
  const datos = kpis
    ? [
        { title: "Activas", value: kpis.usuariosActivos },
        { title: "Inactivas", value: kpis.usuarios - kpis.usuariosActivos },
      ].filter((d) => d.value > 0)
    : [];
  return (
    <Container fitHeight header={<Header variant="h2" description="Cuentas que pueden iniciar sesión">Estado de las cuentas</Header>}>
      <PieChart
        variant="donut"
        size="medium"
        hideFilter
        statusType={estado}
        data={datos}
        innerMetricValue={kpis ? numero(kpis.usuarios) : undefined}
        innerMetricDescription="cuentas"
        segmentDescription={(d, total) => `${numero(d.value)} · ${porcentaje(d.value, total)} %`}
        detailPopoverContent={(d, total) => [
          { key: "Cuentas", value: numero(d.value) },
          { key: "Proporción", value: `${porcentaje(d.value, total)} %` },
        ]}
        ariaLabel="Estado de las cuentas"
        empty={<EstadoVacio titulo="Sin cuentas" texto="Aún no hay usuarios." />}
        onRecoveryClick={onReintentar}
      />
    </Container>
  );
}
