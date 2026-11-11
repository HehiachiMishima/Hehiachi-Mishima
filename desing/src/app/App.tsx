import { useEffect, useState } from "react";
import { RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@cloudscape-design/components/i18n";
import mensajesEs from "@cloudscape-design/components/i18n/messages/all.es";

import { crearClienteConsultas } from "@/core/consultas";
import { NotificacionesProvider } from "@/core/notificaciones/NotificacionesProvider";
import * as almacen from "@/core/sesion/almacen";
import { SesionProvider } from "@/core/sesion/SesionProvider";
import { crearRouter } from "./rutas";

/** Composición de proveedores: textos de Cloudscape, caché de datos, sesión, avisos y rutas. */
export function App() {
  const [clienteConsultas] = useState(crearClienteConsultas);
  const [router] = useState(crearRouter);

  // Al cerrar sesión se borra la caché: los datos de un usuario no deben verse en la sesión de otro.
  useEffect(() => almacen.suscribir(() => !almacen.leerSesion() && clienteConsultas.clear()), [clienteConsultas]);

  return (
    <I18nProvider locale="es" messages={[mensajesEs]}>
      <QueryClientProvider client={clienteConsultas}>
        <SesionProvider>
          <NotificacionesProvider>
            <RouterProvider router={router} />
          </NotificacionesProvider>
        </SesionProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
