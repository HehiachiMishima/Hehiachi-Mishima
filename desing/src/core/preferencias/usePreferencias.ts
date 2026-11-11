import { useState } from "react";
import { guardarPreferencias, leerPreferencias, type Preferencias } from "./preferencias";

export function usePreferencias() {
  const [prefs, setPrefs] = useState<Preferencias>(leerPreferencias);
  const cambiar = (cambios: Partial<Preferencias>) => {
    const nuevas = { ...prefs, ...cambios };
    setPrefs(nuevas);
    guardarPreferencias(nuevas);
  };
  return { prefs, cambiar };
}
