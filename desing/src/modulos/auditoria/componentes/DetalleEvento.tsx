import { useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import CopyToClipboard from "@cloudscape-design/components/copy-to-clipboard";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Header from "@cloudscape-design/components/header";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import Toggle from "@cloudscape-design/components/toggle";
import { actorDeEvento, objetivoDeEvento, resultadoDe } from "@/compartido/auditoria/etiquetas";
import type { AuditoriaEvento } from "@/compartido/auditoria/tipos";
import { fechaCompleta, haceCuanto } from "@/compartido/util/formato";
import { navegador } from "@/compartido/util/navegador";

interface Diferencia {
  campo: string;
  antes: string;
  despues: string;
  cambiado: boolean;
}

const legible = (v: unknown): string => (v === undefined || v === null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

function diferencias(e: AuditoriaEvento): Diferencia[] {
  const antes = e.detalle?.antes ?? {};
  const despues = e.detalle?.despues ?? {};
  return [...new Set([...Object.keys(antes), ...Object.keys(despues)])].map((campo) => {
    const a = legible(antes[campo]);
    const d = legible(despues[campo]);
    return { campo, antes: a, despues: d, cambiado: a !== d };
  });
}

/** Contenido del panel de detalle de un evento: quién, dónde, qué cambió y atajos de investigación. */
export function DetalleEvento({
  evento,
  onVerActor,
  onVerEntidad,
  onVerPeticion,
}: {
  evento: AuditoriaEvento;
  onVerActor: (e: AuditoriaEvento) => void;
  onVerEntidad: (e: AuditoriaEvento) => void;
  onVerPeticion: (id: string) => void;
}) {
  const [todos, setTodos] = useState(false);
  const r = resultadoDe(evento.resultado);
  const filas = diferencias(evento);
  const visibles = todos ? filas : filas.filter((f) => f.cambiado);
  const hayCambios = !!(evento.detalle?.antes || evento.detalle?.despues);

  return (
    <SpaceBetween size="l">
      <SpaceBetween direction="horizontal" size="xs">
        {evento.entidad && evento.entidadId && <Button onClick={() => onVerEntidad(evento)}>Historial de esta entidad</Button>}
        {evento.actorId !== null && evento.actorId !== 0 && <Button onClick={() => onVerActor(evento)}>Todo lo hecho por este actor</Button>}
      </SpaceBetween>
      <KeyValuePairs
        columns={2}
        items={[
          { label: "Resultado", value: <StatusIndicator type={r.tipo}>{r.etiqueta}</StatusIndicator> },
          { label: "Cuándo", value: `${fechaCompleta(evento.ocurridoEn)} (${haceCuanto(evento.ocurridoEn)})` },
          { label: "Actor", value: actorDeEvento(evento) },
          { label: "Objetivo", value: objetivoDeEvento(evento) },
          { label: "IP", value: evento.ip ?? "—" },
          { label: "Cliente", value: <span title={evento.userAgent ?? ""}>{navegador(evento.userAgent)}</span> },
          {
            label: "Id de petición",
            value: evento.idCorrelacion ? (
              <SpaceBetween size="xxs">
                <CopyToClipboard variant="inline" textToCopy={evento.idCorrelacion} copySuccessText="Identificador copiado" copyErrorText="No se pudo copiar" copyButtonAriaLabel="Copiar identificador de la petición" />
                <Button variant="inline-link" onClick={() => onVerPeticion(evento.idCorrelacion!)}>
                  Ver eventos de esta petición
                </Button>
              </SpaceBetween>
            ) : (
              "—"
            ),
          },
        ]}
      />
      {evento.detalle?.motivo && (
        <Alert type="info" header="Motivo">
          {evento.detalle.motivo}
        </Alert>
      )}
      {hayCambios ? (
        <Table
          variant="embedded"
          header={
            <Header variant="h3" actions={<Toggle checked={todos} onChange={({ detail }) => setTodos(detail.checked)}>Mostrar todos los campos</Toggle>}>
              Antes y después
            </Header>
          }
          items={visibles}
          trackBy="campo"
          ariaLabels={{ tableLabel: "Cambios del evento" }}
          empty={<Box color="text-body-secondary">Ningún campo cambió.</Box>}
          columnDefinitions={[
            { id: "campo", header: "Campo", cell: (f) => <Box variant="code">{f.campo}</Box>, isRowHeader: true },
            { id: "antes", header: "Antes", cell: (f) => f.antes },
            { id: "despues", header: "Después", cell: (f) => (f.cambiado ? <Box fontWeight="bold">{f.despues}</Box> : f.despues) },
          ]}
        />
      ) : (
        !evento.detalle?.motivo && <Box color="text-body-secondary">Este evento no registra cambios de datos.</Box>
      )}
      {evento.detalle && (
        <ExpandableSection headerText="Detalle técnico">
          <Box variant="pre">{JSON.stringify(evento.detalle, null, 2)}</Box>
        </ExpandableSection>
      )}
    </SpaceBetween>
  );
}
