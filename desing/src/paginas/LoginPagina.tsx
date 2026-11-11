import { useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Grid from "@cloudscape-design/components/grid";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";

import { ENTORNO } from "@/config/entorno";
import { mensajeDeError } from "@/core/api/errores";
import { iniciarSesion } from "@/core/sesion/autenticacion";
import type { MotivoFin } from "@/core/sesion/tipos";
import { useSesion } from "@/core/sesion/useSesion";

const AVISOS: Record<MotivoFin, string | null> = {
  expirada: "Tu sesión terminó por inactividad o por tiempo máximo. Vuelve a iniciar sesión.",
  revocada: "Tu sesión ya no es válida (por ejemplo, se cambió tu contraseña o un administrador la cerró).",
  cerrada: null,
};

/** Inicio de sesión: único lugar donde se pide la contraseña. Al entrar, SoloInvitado redirige a donde se quería ir. */
export function LoginPagina() {
  const { motivoFin } = useSesion();
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentado, setIntentado] = useState(false);

  const faltaUsuario = intentado && !usuario.trim();
  const faltaContrasena = intentado && !contrasena;
  const aviso = motivoFin ? AVISOS[motivoFin] : null;

  const enviar = async () => {
    setIntentado(true);
    setError(null);
    if (!usuario.trim() || !contrasena) return;
    setEnviando(true);
    try {
      await iniciarSesion(usuario.trim(), contrasena);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo iniciar sesión."));
      setContrasena("");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Box padding={{ vertical: "xxxl", horizontal: "l" }}>
      <Grid gridDefinition={[{ colspan: { default: 12, s: 8, m: 6, l: 4 }, offset: { default: 0, s: 2, m: 3, l: 4 } }]}>
        <form onSubmit={(e) => (e.preventDefault(), void enviar())}>
          <Form
            header={
              <Header variant="h1" description="Consola de control de accesos y monitoreo">
                {ENTORNO.nombreProducto}
              </Header>
            }
            errorText={error}
            errorIconAriaLabel="Error"
            actions={
              <Button variant="primary" formAction="submit" loading={enviando} loadingText="Iniciando sesión">
                Iniciar sesión
              </Button>
            }
          >
            <SpaceBetween size="l">
              {aviso && <Alert type="warning">{aviso}</Alert>}
              <Container header={<Header variant="h2">Iniciar sesión</Header>}>
                <SpaceBetween size="l">
                  <FormField label="Usuario o correo electrónico" controlId="login-usuario" errorText={faltaUsuario && "Escribe tu usuario o correo."}>
                    <Input
                      controlId="login-usuario"
                      value={usuario}
                      onChange={({ detail }) => setUsuario(detail.value)}
                      autoComplete="username"
                      autoFocus
                      invalid={faltaUsuario}
                      disableBrowserAutocorrect
                    />
                  </FormField>
                  <FormField label="Contraseña" controlId="login-contrasena" errorText={faltaContrasena && "Escribe tu contraseña."}>
                    <Input
                      controlId="login-contrasena"
                      type="password"
                      value={contrasena}
                      onChange={({ detail }) => setContrasena(detail.value)}
                      autoComplete="current-password"
                      invalid={faltaContrasena}
                    />
                  </FormField>
                </SpaceBetween>
              </Container>
              <Box variant="small" color="text-body-secondary">
                Acceso restringido y auditado. La sesión se mantiene mientras trabajes, sin volver a pedir la contraseña.
              </Box>
            </SpaceBetween>
          </Form>
        </form>
      </Grid>
    </Box>
  );
}
