import Button from "@cloudscape-design/components/button";
import CopyToClipboard from "@cloudscape-design/components/copy-to-clipboard";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { fechaCompleta, login, numero } from "@/compartido/util/formato";
import { navegador } from "@/compartido/util/navegador";
import type { PeticionTraza } from "../tipos";
import { EstadoHttp } from "./EstadoHttp";

export function DetallePeticion({
  peticion: p,
  onVerAuditoria,
  onFiltrarEndpoint,
}: {
  peticion: PeticionTraza;
  onVerAuditoria?: (idCorrelacion: string) => void;
  onFiltrarEndpoint: (ruta: string) => void;
}) {
  return (
    <SpaceBetween size="l">
      <SpaceBetween direction="horizontal" size="xs">
        <Button onClick={() => onFiltrarEndpoint(p.ruta)}>Ver solo este endpoint</Button>
        {onVerAuditoria && p.idCorrelacion && <Button onClick={() => onVerAuditoria(p.idCorrelacion!)}>Eventos de auditoría de esta petición</Button>}
      </SpaceBetween>
      <KeyValuePairs
        columns={2}
        items={[
          { label: "Resultado", value: <EstadoHttp estado={p.estado} /> },
          { label: "Duración", value: `${numero(p.duracionMs)} ms` },
          { label: "Endpoint", value: `${p.metodo} ${p.ruta}` },
          { label: "Ruta real", value: p.uri },
          { label: "Fecha", value: fechaCompleta(p.ocurridoEn) },
          { label: "Usuario", value: p.actorId ? login(p.actorUsuario ?? `#${p.actorId}`) : "Anónimo" },
          { label: "IP", value: p.ip ?? "—" },
          { label: "Cliente", value: <span title={p.userAgent ?? ""}>{navegador(p.userAgent)}</span> },
          {
            label: "Id de petición",
            value: p.idCorrelacion ? (
              <CopyToClipboard variant="inline" textToCopy={p.idCorrelacion} copySuccessText="Identificador copiado" copyErrorText="No se pudo copiar" copyButtonAriaLabel="Copiar identificador de la petición" />
            ) : (
              "—"
            ),
          },
        ]}
      />
    </SpaceBetween>
  );
}
