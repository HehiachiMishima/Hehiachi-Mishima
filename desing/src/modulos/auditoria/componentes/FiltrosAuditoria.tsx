import { useEffect, useState } from "react";
import Autosuggest from "@cloudscape-design/components/autosuggest";
import DateRangePicker from "@cloudscape-design/components/date-range-picker";
import Grid from "@cloudscape-design/components/grid";
import Select, { type SelectProps } from "@cloudscape-design/components/select";
import TextFilter from "@cloudscape-design/components/text-filter";
import { ENTIDADES_AUDITORIA, etiquetaAccion, GRUPOS_ACCIONES, RESULTADOS_AUDITORIA } from "@/compartido/auditoria/etiquetas";
import type { EntradaDirectorio } from "@/compartido/datos/directorio";
import { login } from "@/compartido/util/formato";
import { RANGOS_RELATIVOS, rangoAUrl, textoRango, validarRango } from "@/compartido/util/rangos";
import type { ClaveUrl, FiltrosUi } from "../filtros";

type Cambio = Partial<Record<ClaveUrl, string | null>>;

const TODAS: SelectProps.Option = { value: "", label: "Todas las acciones" };
const OPCIONES_ACCION: SelectProps.Options = [
  TODAS,
  ...GRUPOS_ACCIONES.map((g) => ({ label: g.nombre, options: g.acciones.map((a) => ({ value: a, label: etiquetaAccion(a) })) })),
];
const OPCIONES_ENTIDAD: SelectProps.Option[] = [{ value: "", label: "Todas las entidades" }, ...Object.entries(ENTIDADES_AUDITORIA).map(([value, label]) => ({ value, label }))];
const OPCIONES_RESULTADO: SelectProps.Option[] = [{ value: "", label: "Todos los resultados" }, ...Object.entries(RESULTADOS_AUDITORIA).map(([value, r]) => ({ value, label: r.etiqueta }))];

const opcion = (lista: SelectProps.Option[], v: string) => lista.find((o) => o.value === v) ?? lista[0];

/** Filtros de la bitácora. Cada cambio va a la URL (la página reacciona a ella). */
export function FiltrosAuditoria({ filtros, actores, onCambio }: { filtros: FiltrosUi; actores: EntradaDirectorio[]; onCambio: (c: Cambio) => void }) {
  const [texto, setTexto] = useState(filtros.q);
  // Si la URL cambia desde fuera (p. ej. "Ver eventos de esta petición"), el campo la sigue.
  const [qPrevia, setQPrevia] = useState(filtros.q);
  if (filtros.q !== qPrevia) {
    setQPrevia(filtros.q);
    setTexto(filtros.q);
  }
  const actor = actores.find((u) => u.id === filtros.actorId);
  const [actorTexto, setActorTexto] = useState(actor ? login(actor.usuario) : filtros.actorId ? `#${filtros.actorId}` : "");

  // La búsqueda libre se aplica 400 ms después de dejar de escribir.
  useEffect(() => {
    if (texto === filtros.q) return;
    const t = setTimeout(() => onCambio({ q: texto || null }), 400);
    return () => clearTimeout(t);
  }, [texto, filtros.q, onCambio]);

  const accionSel: SelectProps.Option = !filtros.accion
    ? TODAS
    : filtros.accion.includes(",")
      ? { value: filtros.accion, label: "Varias acciones" }
      : { value: filtros.accion, label: etiquetaAccion(filtros.accion) };

  const col = { colspan: { default: 12, xs: 6, s: 3 } };
  return (
    <Grid gridDefinition={[{ colspan: { default: 12, s: 6 } }, { colspan: { default: 12, s: 6 } }, col, col, col, col]}>
      <DateRangePicker
        value={filtros.rango}
        onChange={({ detail }) => onCambio(rangoAUrl(detail.value))}
        relativeOptions={RANGOS_RELATIVOS}
        isValidRange={validarRango}
        i18nStrings={{ formatRelativeRange: textoRango }}
        placeholder="Periodo"
        rangeSelectorMode="default"
        expandToViewport
      />
      <TextFilter
        filteringText={texto}
        onChange={({ detail }) => setTexto(detail.filteringText)}
        filteringPlaceholder="Usuario (prefijo), id de registro o de petición"
        filteringAriaLabel="Búsqueda libre en la bitácora"
      />
      <Select
        selectedOption={accionSel}
        options={OPCIONES_ACCION}
        onChange={({ detail }) => onCambio({ accion: detail.selectedOption.value || null })}
        filteringType="auto"
        ariaLabel="Acción"
        expandToViewport
      />
      <Select
        selectedOption={opcion(OPCIONES_ENTIDAD, filtros.entidad)}
        options={OPCIONES_ENTIDAD}
        onChange={({ detail }) => onCambio({ entidad: detail.selectedOption.value || null, entidadId: null })}
        ariaLabel="Entidad"
        expandToViewport
      />
      <Select
        selectedOption={opcion(OPCIONES_RESULTADO, filtros.resultado)}
        options={OPCIONES_RESULTADO}
        onChange={({ detail }) => onCambio({ resultado: detail.selectedOption.value || null })}
        ariaLabel="Resultado"
        expandToViewport
      />
      <Autosuggest
        value={actorTexto}
        onChange={({ detail }) => {
          setActorTexto(detail.value);
          if (!detail.value) onCambio({ actorId: null });
        }}
        onSelect={({ detail }) => {
          const u = actores.find((a) => String(a.id) === detail.value);
          setActorTexto(u ? login(u.usuario) : detail.value);
          onCambio({ actorId: detail.value || null });
        }}
        options={actores.map((u) => ({ value: String(u.id), label: login(u.usuario), description: `${u.nombre} ${u.apellido}` }))}
        placeholder="Actor (@usuario)"
        ariaLabel="Actor"
        empty="Sin coincidencias"
        expandToViewport
      />
    </Grid>
  );
}
