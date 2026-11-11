import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import Badge from "@cloudscape-design/components/badge";
import Button from "@cloudscape-design/components/button";
import Checkbox from "@cloudscape-design/components/checkbox";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import Multiselect from "@cloudscape-design/components/multiselect";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Toggle from "@cloudscape-design/components/toggle";
import Wizard, { type WizardProps } from "@cloudscape-design/components/wizard";
import { CargandoPagina } from "@/compartido/componentes/CargandoPagina";
import { RequisitosContrasena } from "@/compartido/componentes/RequisitosContrasena";
import { useMarcoPagina } from "@/compartido/marco/useMarcoPagina";
import { contrasenaValida } from "@/compartido/util/contrasena";
import { login } from "@/compartido/util/formato";
import { ErrorApi, mensajeDeError } from "@/core/api/errores";
import { useNotificaciones } from "@/core/notificaciones/contexto";
import { PERMISOS } from "@/core/sesion/permisos";
import { useSesion } from "@/core/sesion/useSesion";
import { useCatalogoRoles, useGuardarUsuario, useUsuario } from "../consultas";
import type { Usuario } from "../tipos";
import { InfoAyuda } from "@/compartido/marco/InfoAyuda";

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Alta o edición de una cuenta (patrón de formulario de página completa). */
export function FormularioUsuario() {
  const params = useParams();
  const id = params.id ? Number(params.id) : undefined;
  const consulta = useUsuario(id ?? 0);
  if (id && consulta.isPending) return <CargandoPagina />;
  return <Formulario key={id ?? "nuevo"} id={id} inicial={id ? consulta.data : undefined} />;
}

function Formulario({ id, inicial }: { id?: number; inicial?: Usuario }) {
  const navegar = useNavigate();
  const { puede } = useSesion();
  const { notificar } = useNotificaciones();
  const guardar = useGuardarUsuario();
  const catalogo = useCatalogoRoles();
  const editando = id !== undefined;

  const [v, setV] = useState({
    usuario: inicial?.usuario ?? "",
    nombre: inicial?.nombre ?? "",
    apellido: inicial?.apellido ?? "",
    email: inicial?.email ?? "",
    telefono: inicial?.telefono ?? "",
    activo: inicial?.activo ?? true,
  });
  const [contrasena, setContrasena] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [ver, setVer] = useState(false);
  const [roles, setRoles] = useState<readonly { value?: string; label?: string }[]>([]);
  const [enviado, setEnviado] = useState(false);
  const [enviadoClave, setEnviadoClave] = useState(false);
  const [paso, setPaso] = useState(0);
  const [servidor, setServidor] = useState<{ general?: string; campos: Record<string, string> }>({ campos: {} });

  useMarcoPagina({
    migas: editando ? [{ text: login(inicial?.usuario ?? `#${id}`), href: `/usuarios/${id}` }, { text: "Editar", href: `/usuarios/${id}/editar` }] : [{ text: "Crear usuario", href: "/usuarios/nuevo" }],
    tipo: "form",
  });

  const cambia = (campo: keyof typeof v) => (valor: string | boolean) => {
    setV((p) => ({ ...p, [campo]: valor }));
    setServidor((s) => ({ ...s, campos: { ...s.campos, [campo]: "" } }));
  };
  const obligatorio = (valor: string, max: number, texto: string) => (enviado && !valor.trim() ? texto : valor.length > max ? `Máximo ${max} caracteres.` : undefined);
  const errores = {
    usuario: servidor.campos.usuario || obligatorio(v.usuario, 50, "El usuario es obligatorio."),
    nombre: servidor.campos.nombre || obligatorio(v.nombre, 100, "El nombre es obligatorio."),
    apellido: servidor.campos.apellido || obligatorio(v.apellido, 100, "El apellido es obligatorio."),
    email: servidor.campos.email || obligatorio(v.email, 150, "El correo es obligatorio.") || (enviado && !CORREO.test(v.email) ? "Escribe un correo válido." : undefined),
    telefono: servidor.campos.telefono || (v.telefono.length > 20 ? "Máximo 20 caracteres." : undefined),
    contrasena: editando ? undefined : servidor.campos.contrasena || (enviadoClave && !contrasenaValida(contrasena) ? "La contraseña no cumple los requisitos." : undefined),
    confirmacion: editando ? undefined : enviadoClave && confirmacion !== contrasena ? "Las contraseñas no coinciden." : undefined,
  };

  const datosValidos = !!(v.usuario.trim() && v.nombre.trim() && v.apellido.trim() && CORREO.test(v.email)) && v.usuario.length <= 50 && v.telefono.length <= 20;
  const claveValida = contrasenaValida(contrasena) && contrasena === confirmacion;

  const enviar = () => {
    setEnviado(true);
    setEnviadoClave(true);
    if (!datosValidos || (!editando && !claveValida)) return;
    setServidor({ campos: {} });
    guardar.mutate(
      {
        id,
        datos: { ...v, usuario: v.usuario.trim(), telefono: v.telefono.trim() || null, ...(editando ? {} : { contrasena }) },
        rolesIniciales: roles.map((r) => Number(r.value)),
      },
      {
        onSuccess: (u) => {
          notificar({ type: "success", content: editando ? `Se guardaron los cambios de ${login(u.usuario)}.` : `${login(u.usuario)} fue creado.` });
          navegar(`/usuarios/${u.id}`);
        },
        onError: (e) => {
          const campos = e instanceof ErrorApi ? e.campos : {};
          setServidor({ campos, general: Object.keys(campos).length ? undefined : mensajeDeError(e) });
          // En el asistente, vuelve al paso que tiene el campo con error.
          if (campos.contrasena) setPaso(1);
          else if (Object.keys(campos).length) setPaso(0);
        },
      },
    );
  };

  const tipo = ver ? "text" : "password";
  const rolesActivos = (catalogo.data ?? []).filter((r) => r.activo);

  const seccionDatos = (
    <Container header={<Header variant="h2">Datos de la cuenta</Header>}>
      <SpaceBetween size="m">
        <ColumnLayout columns={2}>
          <FormField label="Usuario" errorText={errores.usuario} constraintText="Con el que inicia sesión. Máximo 50 caracteres.">
            <Input value={v.usuario} placeholder="ana.perez" autoComplete="off" onChange={({ detail }) => cambia("usuario")(detail.value)} />
          </FormField>
          <FormField label="Correo electrónico" errorText={errores.email}>
            <Input type="email" value={v.email} placeholder="ana@empresa.com" autoComplete="off" onChange={({ detail }) => cambia("email")(detail.value)} />
          </FormField>
          <FormField label="Nombre" errorText={errores.nombre}>
            <Input value={v.nombre} onChange={({ detail }) => cambia("nombre")(detail.value)} />
          </FormField>
          <FormField label="Apellido" errorText={errores.apellido}>
            <Input value={v.apellido} onChange={({ detail }) => cambia("apellido")(detail.value)} />
          </FormField>
          <FormField label={<>Teléfono <i>- opcional</i></>} errorText={errores.telefono}>
            <Input type="text" inputMode="tel" value={v.telefono} onChange={({ detail }) => cambia("telefono")(detail.value)} />
          </FormField>
        </ColumnLayout>
        <Checkbox checked={v.activo} onChange={({ detail }) => cambia("activo")(detail.checked)} description="Si no está activa, la cuenta existe pero no puede iniciar sesión.">
          Cuenta activa
        </Checkbox>
      </SpaceBetween>
    </Container>
  );

  const seccionClave = (
    <Container header={<Header variant="h2">Contraseña inicial</Header>}>
      <SpaceBetween size="m">
        <ColumnLayout columns={2}>
          <FormField label="Contraseña" errorText={errores.contrasena}>
            <SpaceBetween size="xs">
              <Input type={tipo} value={contrasena} autoComplete="new-password" onChange={({ detail }) => setContrasena(detail.value)} />
              <RequisitosContrasena valor={contrasena} />
            </SpaceBetween>
          </FormField>
          <FormField label="Confirmar contraseña" errorText={errores.confirmacion}>
            <Input type={tipo} value={confirmacion} autoComplete="new-password" onChange={({ detail }) => setConfirmacion(detail.value)} />
          </FormField>
        </ColumnLayout>
        <Toggle checked={ver} onChange={({ detail }) => setVer(detail.checked)}>
          Mostrar contraseñas
        </Toggle>
      </SpaceBetween>
    </Container>
  );

  const seccionRoles = (
    <Container header={<Header variant="h2" description="Sin roles, la cuenta no tendrá acceso. Puedes asignarlos ahora o más tarde.">Roles iniciales</Header>}>
      <FormField label={<>Roles <i>- opcional</i></>}>
        <Multiselect
          selectedOptions={roles}
          onChange={({ detail }) => setRoles(detail.selectedOptions)}
          options={rolesActivos.map((r) => ({ value: String(r.id), label: r.nombre, description: r.descripcion ?? undefined }))}
          placeholder="Elige roles"
          filteringType="auto"
          statusType={catalogo.isPending ? "loading" : catalogo.isError ? "error" : "finished"}
          loadingText="Cargando roles"
          errorText="No se pudieron cargar los roles."
          empty="No hay roles activos."
          tokenLimit={5}
        />
      </FormField>
    </Container>
  );

  const cabecera = (
    <Header variant="h1" info={<InfoAyuda />} description="Los cambios quedan registrados en la auditoría.">
      Editar usuario
    </Header>
  );

  if (editando) {
    return (
      <ContentLayout header={cabecera}>
        <form onSubmit={(e) => (e.preventDefault(), enviar())}>
          <Form
            errorText={servidor.general}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => navegar(`/usuarios/${id}`)}>
                  Cancelar
                </Button>
                <Button variant="primary" formAction="submit" loading={guardar.isPending}>
                  Guardar cambios
                </Button>
              </SpaceBetween>
            }
          >
            {seccionDatos}
          </Form>
        </form>
      </ContentLayout>
    );
  }

  // Alta: asistente por pasos; cada paso se valida antes de avanzar.
  const asignaRoles = puede(PERMISOS.ASIGNAR_ROLES);
  const pasos: WizardProps.Step[] = [
    { title: "Datos de la cuenta", info: <InfoAyuda />, description: "La persona podrá iniciar sesión con este usuario y contraseña.", content: seccionDatos },
    { title: "Contraseña inicial", description: "Comunícasela por un canal seguro.", content: seccionClave },
    ...(asignaRoles ? [{ title: "Roles iniciales", isOptional: true, description: "Definen a qué tendrá acceso.", content: seccionRoles }] : []),
    {
      title: "Revisar y crear",
      errorText: servidor.general,
      content: (
        <SpaceBetween size="l">
          <Container header={<Header variant="h2" actions={<Button onClick={() => setPaso(0)}>Editar</Button>}>Paso 1: Datos de la cuenta</Header>}>
            <KeyValuePairs
              columns={3}
              items={[
                { label: "Usuario", value: login(v.usuario) },
                { label: "Nombre", value: `${v.nombre} ${v.apellido}` },
                { label: "Correo electrónico", value: v.email },
                { label: "Teléfono", value: v.telefono || "Sin teléfono" },
                { label: "Estado", value: <StatusIndicator type={v.activo ? "success" : "stopped"}>{v.activo ? "Activa" : "Inactiva"}</StatusIndicator> },
              ]}
            />
          </Container>
          <Container header={<Header variant="h2" actions={<Button onClick={() => setPaso(1)}>Editar</Button>}>Paso 2: Contraseña inicial</Header>}>
            <StatusIndicator type="success">Cumple la política de contraseñas</StatusIndicator>
          </Container>
          {asignaRoles && (
            <Container header={<Header variant="h2" actions={<Button onClick={() => setPaso(2)}>Editar</Button>}>Paso 3: Roles iniciales</Header>}>
              {roles.length ? (
                <SpaceBetween direction="horizontal" size="xs">
                  {roles.map((r) => (
                    <Badge key={r.value} color="blue">
                      {r.label}
                    </Badge>
                  ))}
                </SpaceBetween>
              ) : (
                <StatusIndicator type="warning">Sin roles: la cuenta no tendrá acceso hasta que se le asigne uno.</StatusIndicator>
              )}
            </Container>
          )}
        </SpaceBetween>
      ),
    },
  ];

  return (
    // El título de cada paso es el h1 de la página (patrón de asistente de Cloudscape).
    <ContentLayout>
      <Wizard
        steps={pasos}
        activeStepIndex={paso}
        onNavigate={({ detail }) => {
          if (detail.requestedStepIndex > paso) {
            if (paso === 0) {
              setEnviado(true);
              if (!datosValidos) return;
            }
            if (paso === 1) {
              setEnviadoClave(true);
              if (!claveValida) return;
            }
          }
          setPaso(detail.requestedStepIndex);
        }}
        onCancel={() => navegar("/usuarios")}
        onSubmit={enviar}
        isLoadingNextStep={guardar.isPending}
        submitButtonText="Crear usuario"
        allowSkipTo
        i18nStrings={{
          stepNumberLabel: (n) => `Paso ${n}`,
          collapsedStepsLabel: (n, total) => `Paso ${n} de ${total}`,
          skipToButtonLabel: (paso) => `Ir a ${paso.title}`,
          navigationAriaLabel: "Pasos",
          cancelButton: "Cancelar",
          previousButton: "Anterior",
          nextButton: "Siguiente",
          optional: "opcional",
        }}
      />
    </ContentLayout>
  );
}
