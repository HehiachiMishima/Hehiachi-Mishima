import { useState } from "react";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Toggle from "@cloudscape-design/components/toggle";
import { RequisitosContrasena } from "@/compartido/componentes/RequisitosContrasena";
import { contrasenaValida } from "@/compartido/util/contrasena";
import { login, numero } from "@/compartido/util/formato";
import { ErrorApi, mensajeDeError } from "@/core/api/errores";
import { useNotificaciones } from "@/core/notificaciones/contexto";
import { cambiarContrasena } from "@/core/sesion/autenticacion";
import { etiquetaPermiso } from "@/core/sesion/permisos";
import { useSesion } from "@/core/sesion/useSesion";

/** Mi cuenta: identidad, permisos efectivos y cambio de la contraseña propia. */
export function CuentaPagina() {
  const { usuario, permisos } = useSesion();
  const { notificar } = useNotificaciones();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [ver, setVer] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<{ general?: string; campos: Record<string, string> }>({ campos: {} });

  const errorActual = errores.campos.contrasenaActual ?? (enviado && !actual ? "Escribe tu contraseña actual." : undefined);
  const errorNueva = errores.campos.contrasenaNueva ?? (enviado && !contrasenaValida(nueva) ? "La contraseña no cumple los requisitos." : enviado && nueva === actual ? "Debe ser distinta de la actual." : undefined);
  const errorConfirmacion = enviado && confirmacion !== nueva ? "Las contraseñas no coinciden." : undefined;

  const guardar = async () => {
    setEnviado(true);
    setErrores({ campos: {} });
    if (!actual || !contrasenaValida(nueva) || nueva === actual || confirmacion !== nueva) return;
    setGuardando(true);
    try {
      await cambiarContrasena(actual, nueva);
      setActual("");
      setNueva("");
      setConfirmacion("");
      setEnviado(false);
      notificar({ type: "success", header: "Contraseña cambiada", content: "Se cerraron tus otras sesiones abiertas; esta sigue activa." });
    } catch (e) {
      const campos = e instanceof ErrorApi ? e.campos : {};
      setErrores({ campos, general: Object.keys(campos).length ? undefined : mensajeDeError(e) });
    } finally {
      setGuardando(false);
    }
  };

  const tipo = ver ? "text" : "password";
  return (
    <ContentLayout header={<Header variant="h1" description="Tus datos de acceso y tu contraseña">Mi cuenta</Header>}>
      <SpaceBetween size="l">
        <Container header={<Header variant="h2">Datos de la cuenta</Header>}>
          <SpaceBetween size="l">
            <KeyValuePairs
              columns={3}
              items={[
                { label: "Usuario", value: login(usuario?.usuario) },
                { label: "Nombre", value: usuario ? `${usuario.nombre} ${usuario.apellido}` : "—" },
                { label: "Correo electrónico", value: usuario?.email ?? "—" },
              ]}
            />
            <ExpandableSection headerText={`Mis permisos (${numero(permisos.length)})`}>
              <SpaceBetween size="xxs">
                {[...permisos].sort().map((p) => (
                  <Box key={p}>
                    {etiquetaPermiso(p)}{" "}
                    <Box variant="code" display="inline">
                      {p}
                    </Box>
                  </Box>
                ))}
              </SpaceBetween>
            </ExpandableSection>
          </SpaceBetween>
        </Container>

        <form onSubmit={(e) => (e.preventDefault(), void guardar())}>
          <Form
            errorText={errores.general}
            actions={
              <Button variant="primary" loading={guardando} formAction="submit">
                Cambiar contraseña
              </Button>
            }
          >
            <Container header={<Header variant="h2" description="Al cambiarla se cierran tus otras sesiones abiertas.">Cambiar contraseña</Header>}>
              <SpaceBetween size="m">
                <FormField label="Contraseña actual" errorText={errorActual}>
                  <Input type={tipo} value={actual} autoComplete="current-password" onChange={({ detail }) => setActual(detail.value)} />
                </FormField>
                <FormField label="Contraseña nueva" errorText={errorNueva} description="Usa una frase larga que no uses en otros sitios.">
                  <SpaceBetween size="xs">
                    <Input type={tipo} value={nueva} autoComplete="new-password" onChange={({ detail }) => setNueva(detail.value)} />
                    <RequisitosContrasena valor={nueva} />
                  </SpaceBetween>
                </FormField>
                <FormField label="Confirmar contraseña nueva" errorText={errorConfirmacion}>
                  <Input type={tipo} value={confirmacion} autoComplete="new-password" onChange={({ detail }) => setConfirmacion(detail.value)} />
                </FormField>
                <Toggle checked={ver} onChange={({ detail }) => setVer(detail.checked)}>
                  Mostrar contraseñas
                </Toggle>
              </SpaceBetween>
            </Container>
          </Form>
        </form>
      </SpaceBetween>
    </ContentLayout>
  );
}
