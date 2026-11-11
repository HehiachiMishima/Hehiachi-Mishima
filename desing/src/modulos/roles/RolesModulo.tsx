import { Route, Routes } from "react-router";
import { NoEncontrada } from "@/compartido/componentes/NoEncontrada";
import { DetalleRol } from "./paginas/DetalleRol";
import { ListaRoles } from "./paginas/ListaRoles";

export default function RolesModulo() {
  return (
    <Routes>
      <Route index element={<ListaRoles />} />
      <Route path=":id" element={<DetalleRol />} />
      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  );
}
