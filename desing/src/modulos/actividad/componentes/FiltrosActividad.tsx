import { useEffect, useState } from "react";
import Autosuggest from "@cloudscape-design/components/autosuggest";
import DateRangePicker from "@cloudscape-design/components/date-range-picker";
import Grid from "@cloudscape-design/components/grid";
import Select, { type SelectProps } from "@cloudscape-design/components/select";
import TextFilter from "@cloudscape-design/components/text-filter";
import Toggle from "@cloudscape-design/components/toggle";
import type { EntradaDirectorio } from "@/compartido/datos/directorio";
import { login } from "@/compartido/util/formato";
import { rangoAUrl, textoRango, validarRango } from "@/compartido/util/rangos";
import { ESTADOS, LENTA_MS, METODOS, RANGOS_RELATIVOS, type FiltrosUi } from "../filtros";

type Cambio = Record<string, string | number | null>;
const opcion = (lista: SelectProps.Option[], v: string) => lista.find((o) => o.value === v) ?? lista[0];

export function FiltrosActividad({ filtros, usuarios, onCambio }: { filtros: FiltrosUi; usuarios: EntradaDirectorio[]; onCambio: (c: Cambio) => void }) {
  const actual = usuarios.find((u) => u.id === filtros.actorId);
  const [usuarioTexto, setUsuarioTexto] = useState(actual ? login(actual.usuario) : filtros.actorId ? `#${filtros.actorId}` : "");
  const [correlacion, setCorrelacion] = useState(filtros.idCorrelacion);
  const [previa, setPrevia] = useState(filtros.idCorrelacion);
  if (filtros.idCorrelacion !== previa) {
    setPrevia(filtros.idCorrelacion);
    setCorrelacion(filtros.idCorrelacion);
  }
  useEffect(() => {
    if (correlacion === filtros.idCorrelacion) return;
    const t = setTimeout(() => onCambio({ idCorrelacion: correlacion.trim() || null }), 400);
    return () => clearTimeout(t);
  }, [correlacion, filtros.idCorrelacion, onCambio]);

  const col = { colspan: { default: 12, xs: 6, s: 3 } };
  return (
    <Grid gridDefinition={[{ colspan: { default: 12, s: 6 } }, { colspan: { default: 12, s: 6 } }, col, col, col, col]}>
      <DateRangePicker
        value={filtros.rango}
        onChange={({ detail }) => onCambio({ ...rangoAUrl(detail.value) })}
        relativeOptions={RANGOS_RELATIVOS}
        isValidRange={validarRango}
        i18nStrings={{ formatRelativeRange: textoRango }}
        placeholder="Periodo"
        expandToViewport
      />
      <TextFilter
        filteringText={correlacion}
        onChange={({ detail }) => setCorrelacion(detail.filteringText)}
        filteringPlaceholder="Id de petición (X-Request-Id)"
        filteringAriaLabel="Buscar por id de petición"
      />
      <Autosuggest
        value={usuarioTexto}
        onChange={({ detail }) => {
          setUsuarioTexto(detail.value);
          if (!detail.value) onCambio({ actorId: null });
        }}
        onSelect={({ detail }) => {
          const u = usuarios.find((a) => String(a.id) === detail.value);
          setUsuarioTexto(u ? login(u.usuario) : detail.value);
          onCambio({ actorId: detail.value || null });
        }}
        options={usuarios.map((u) => ({ value: String(u.id), label: login(u.usuario), description: `${u.nombre} ${u.apellido}` }))}
        placeholder="Usuario (@usuario)"
        ariaLabel="Usuario"
        empty="Sin coincidencias"
        expandToViewport
      />
      <Select selectedOption={opcion(METODOS, filtros.metodo)} options={METODOS} onChange={({ detail }) => onCambio({ metodo: detail.selectedOption.value || null })} ariaLabel="Operación" expandToViewport />
      <Select selectedOption={opcion(ESTADOS, filtros.estado)} options={ESTADOS} onChange={({ detail }) => onCambio({ estado: detail.selectedOption.value || null })} ariaLabel="Resultado" expandToViewport />
      <Toggle checked={filtros.lentas} onChange={({ detail }) => onCambio({ lentas: detail.checked ? "1" : null })}>
        {`Solo lentas (≥ ${LENTA_MS / 1000} s)`}
      </Toggle>
    </Grid>
  );
}
