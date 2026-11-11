import { Route, Routes } from "react-router";
import { RequierePermiso } from "@/compartido/componentes/RequierePermiso";
import { PERMISOS } from "@/core/sesion/permisos";
import { NoEncontrada } from "@/compartido/componentes/NoEncontrada";
import { DetalleUsuario } from "./paginas/DetalleUsuario";
import { FormularioUsuario } from "./paginas/FormularioUsuario";
import { ListaUsuarios } from "./paginas/ListaUsuarios";

/** Subrutas del módulo: lista, alta, detalle y edición (cada una con su permiso). */
export default function UsuariosModulo() {
  return (
    <Routes>
      <Route index element={<ListaUsuarios />} />
      <Route
        path="nuevo"
        element={
          <RequierePermiso permiso={PERMISOS.CREAR_USUARIOS}>
            <FormularioUsuario />
          </RequierePermiso>
        }
      />
      <Route path=":id" element={<DetalleUsuario />} />
      <Route
        path=":id/editar"
        element={
          <RequierePermiso permiso={PERMISOS.MODIFICAR_USUARIOS}>
            <FormularioUsuario />
          </RequierePermiso>
        }
      />
      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  );
}
