import { Navigate } from "react-router";
import { useSesion } from "@/core/sesion/useSesion";
import { modulosAccesibles, rutaDe } from "@/modulos/registro";
import { SinAcceso } from "@/compartido/componentes/SinAcceso";

/** "/" lleva al primer módulo accesible (o explica que no hay ninguno). */
export function Inicio() {
  const { permisos } = useSesion();
  const primero = modulosAccesibles(permisos)[0];
  return primero ? <Navigate to={rutaDe(primero)} replace /> : <SinAcceso sinModulos />;
}
