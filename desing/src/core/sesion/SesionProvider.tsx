import { useEffect } from "react";
import { restaurarSesion } from "./autenticacion";
import { AvisoInactividad } from "./AvisoInactividad";
import { useSesion } from "./useSesion";
import { useVigilanteSesion } from "./useVigilanteSesion";

/** Restaura la sesión al arrancar y vigila su vencimiento. El estado vive en almacen.ts (useSesion). */
export function SesionProvider({ children }: { children: React.ReactNode }) {
  const { sesion, restaurando } = useSesion();
  const { aviso, seguirConectado, salir } = useVigilanteSesion(sesion);

  useEffect(() => {
    if (restaurando) void restaurarSesion();
  }, [restaurando]);

  return (
    <>
      {children}
      <AvisoInactividad cierraA={aviso} onSeguir={seguirConectado} onSalir={salir} />
    </>
  );
}
