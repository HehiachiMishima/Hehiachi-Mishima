import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Grid from "@cloudscape-design/components/grid";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { haceCuanto } from "@/compartido/util/formato";
import { mensajeDeError } from "@/core/api/errores";
import { useSesion } from "@/core/sesion/useSesion";
import { modulosAccesibles, rutaDe } from "@/modulos/registro";
import { AccesosRapidos } from "./componentes/AccesosRapidos";
import { GraficosAcceso } from "./componentes/GraficosAcceso";
import { IndicadoresAcceso } from "./componentes/IndicadoresAcceso";
import { IndicadoresSeguridad } from "./componentes/IndicadoresSeguridad";
import { RequiereAtencion } from "./componentes/RequiereAtencion";
import { claves, useAnalitica, useEventosSeguridad, useIndicadoresSeguridad } from "./consultas";

const FECHA = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" });

function saludo(h: number) {
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

/** Tablero de entrada: estado del control de accesos, lo que requiere atención y accesos rápidos. */
export default function ResumenPagina() {
  const { usuario, permisos } = useSesion();
  const cliente = useQueryClient();
  const [hoy] = useState(() => new Date());
  const analitica = useAnalitica();
  const seguridad = useIndicadoresSeguridad();
  const eventos = useEventosSeguridad();
  const actualizar = () => void cliente.invalidateQueries({ queryKey: claves.todo });

  const accesos = modulosAccesibles(permisos)
    .filter((m) => m.id !== "resumen")
    .map((m) => ({ id: m.id, titulo: m.titulo, descripcion: m.descripcion, href: rutaDe(m) }));

  const estadoGraficos = analitica.isError && !analitica.data ? "error" : analitica.data ? "finished" : "loading";
  const seccionesMedias = seguridad.length ? [{ colspan: { default: 12, m: 6 } }, { colspan: { default: 12, m: 6 } }] : [{ colspan: 12 }];

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description={`${FECHA.format(hoy)} · Estado del control de accesos${analitica.dataUpdatedAt ? ` · actualizado ${haceCuanto(new Date(analitica.dataUpdatedAt))}` : ""}`}
          actions={
            <Button iconName="refresh" loading={analitica.isFetching} onClick={actualizar}>
              Actualizar
            </Button>
          }
        >
          {`${saludo(hoy.getHours())}${usuario ? `, ${usuario.nombre}` : ""}`}
        </Header>
      }
    >
      <SpaceBetween size="l">
        {analitica.isError && (
          <Alert type="error" header="No se pudieron cargar los indicadores" action={<Button onClick={actualizar}>Reintentar</Button>}>
            {mensajeDeError(analitica.error)}
          </Alert>
        )}
        <IndicadoresAcceso kpis={analitica.data?.kpis} />
        <Grid gridDefinition={seccionesMedias}>
          <RequiereAtencion kpis={analitica.data?.kpis} eventos={eventos.data} />
          {seguridad.length > 0 && <IndicadoresSeguridad indicadores={seguridad} />}
        </Grid>
        <GraficosAcceso datos={analitica.data} estado={estadoGraficos} onReintentar={actualizar} />
        {accesos.length > 0 && <AccesosRapidos accesos={accesos} />}
      </SpaceBetween>
    </ContentLayout>
  );
}
