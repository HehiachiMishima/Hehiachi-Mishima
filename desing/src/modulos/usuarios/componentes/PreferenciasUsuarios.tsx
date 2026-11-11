import CollectionPreferences, { type CollectionPreferencesProps } from "@cloudscape-design/components/collection-preferences";

const OPCIONES = [
  { id: "usuario", label: "Usuario", alwaysVisible: true },
  { id: "nombre", label: "Nombre" },
  { id: "email", label: "Correo" },
  { id: "estado", label: "Estado" },
  { id: "roles", label: "Roles" },
  { id: "permisos", label: "Permisos" },
  { id: "telefono", label: "Teléfono" },
  { id: "cambio", label: "Último cambio" },
];

export function PreferenciasUsuarios({ valor, onCambio }: { valor: CollectionPreferencesProps.Preferences; onCambio: (p: CollectionPreferencesProps.Preferences) => void }) {
  return (
    <CollectionPreferences
      title="Preferencias"
      confirmLabel="Confirmar"
      cancelLabel="Cancelar"
      preferences={valor}
      onConfirm={({ detail }) => onCambio(detail)}
      pageSizePreference={{ title: "Tamaño de página", options: [10, 20, 50, 100].map((n) => ({ value: n, label: `${n} usuarios` })) }}
      wrapLinesPreference={{ label: "Ajustar líneas", description: "Muestra el texto completo en varias líneas" }}
      stripedRowsPreference={{ label: "Filas alternas", description: "Sombrea una fila de cada dos" }}
      stickyColumnsPreference={{ firstColumns: { title: "Fijar primera columna", description: "Mantiene visible el usuario al desplazar", options: [{ label: "Ninguna", value: 0 }, { label: "Usuario", value: 1 }] } }}
      contentDisplayPreference={{ title: "Columnas", description: "Visibles y en qué orden", options: OPCIONES }}
    />
  );
}
