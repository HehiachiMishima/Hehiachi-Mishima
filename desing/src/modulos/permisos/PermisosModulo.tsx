import { Route, Routes } from "react-router";
import { NoEncontrada } from "@/compartido/componentes/NoEncontrada";
import { DetallePermiso } from "./paginas/DetallePermiso";
import { ListaPermisos } from "./paginas/ListaPermisos";

export default function PermisosModulo() {
  return (
    <Routes>
      <Route index element={<ListaPermisos />} />
      <Route path=":id" element={<DetallePermiso />} />
      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  );
}
