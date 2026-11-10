package oracle.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.DynamicTest.dynamicTest;

import java.lang.reflect.Parameter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import oracle.soporte.ApiPrueba;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/**
 * Matriz de autorizacion GENERADA desde los @PreAuthorize reales de los
 * controladores (RequestMappingHandlerMapping). Un endpoint nuevo entra solo
 * en la matriz; si su expresion o su @RequestBody no son reconocidos, la
 * prueba falla pidiendo que se actualice este archivo (red de seguridad).
 *
 * Para cada endpoint /api/** con hasAuthority(...):
 *  - sin token -> 401;
 *  - usuario autenticado SIN ninguno de los permisos -> 403;
 *  - para expresiones "A and B": usuario con todos menos uno -> 403 (por cada uno);
 *  - control positivo: el ADMINISTRADOR no recibe 401/403.
 * Los cuerpos son VALIDOS para que @Valid no responda 400 antes que la seguridad.
 */
class MatrizAutorizacionTest extends ApiPrueba {

    private static final Pattern AUTORIDAD = Pattern.compile("hasAuthority\\('([A-Z_]+)'\\)");
    private static final Pattern SOLO_AUTORIDADES =
            Pattern.compile("^\\s*hasAuthority\\('[A-Z_]+'\\)(\\s+and\\s+hasAuthority\\('[A-Z_]+'\\))*\\s*$");
    private static final Pattern VARIABLE = Pattern.compile("\\{[^}]+}");
    private static final String ID_INEXISTENTE = "987654321";
    private static final Set<String> PUBLICOS = Set.of("/api/auth/login", "/api/health");

    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    private RequestMappingHandlerMapping mapeo;

    private static final Map<String, UsuarioPrueba> USUARIOS_POR_PERMISOS = new ConcurrentHashMap<>();

    /** Endpoint con su regla. tipo: PUBLICO, AUTENTICADO o AUTORIDADES. */
    record Endpoint(String metodo, String ruta, String tipo, List<String> autoridades, Class<?> cuerpo) {
        String rutaConcreta() {
            return VARIABLE.matcher(ruta).replaceAll(ID_INEXISTENTE);
        }

        @Override
        public String toString() {
            return metodo + " " + ruta;
        }
    }

    private List<Endpoint> endpoints() {
        List<Endpoint> l = new ArrayList<>();
        for (Map.Entry<RequestMappingInfo, HandlerMethod> e : mapeo.getHandlerMethods().entrySet()) {
            HandlerMethod h = e.getValue();
            Set<String> rutas = e.getKey().getPatternValues();
            Set<RequestMethod> metodos = e.getKey().getMethodsCondition().getMethods();
            for (String ruta : rutas) {
                if (!ruta.startsWith("/api/")) {
                    continue;
                }
                PreAuthorize pa = AnnotatedElementUtils.findMergedAnnotation(h.getMethod(), PreAuthorize.class);
                if (pa == null) {
                    pa = AnnotatedElementUtils.findMergedAnnotation(h.getBeanType(), PreAuthorize.class);
                }
                Class<?> cuerpo = null;
                for (Parameter p : h.getMethod().getParameters()) {
                    if (p.isAnnotationPresent(RequestBody.class)) {
                        cuerpo = p.getType();
                    }
                }
                String tipo;
                List<String> autoridades = new ArrayList<>();
                if (pa == null) {
                    tipo = PUBLICOS.contains(ruta) ? "PUBLICO" : "SIN_PREAUTHORIZE";
                } else if (pa.value().contains("permitAll")) {
                    tipo = "PUBLICO";
                } else if (pa.value().trim().equals("isAuthenticated()")) {
                    tipo = "AUTENTICADO";
                } else if (SOLO_AUTORIDADES.matcher(pa.value()).matches()) {
                    tipo = "AUTORIDADES";
                    Matcher mm = AUTORIDAD.matcher(pa.value());
                    while (mm.find()) {
                        autoridades.add(mm.group(1));
                    }
                } else {
                    tipo = "NO_RECONOCIDA: " + pa.value();
                }
                for (RequestMethod metodo : metodos) {
                    l.add(new Endpoint(metodo.name(), ruta, tipo, autoridades, cuerpo));
                }
            }
        }
        l.sort(Comparator.comparing(Endpoint::ruta).thenComparing(Endpoint::metodo));
        return l;
    }

    /** Cuerpo VALIDO por tipo de @RequestBody (con nombres unicos para el control positivo). */
    private Object cuerpoValido(Class<?> tipo) {
        if (tipo == null) {
            return null;
        }
        return switch (tipo.getSimpleName()) {
            case "UsuarioCrearRequest" -> {
                String u = unico("mx");
                yield m("usuario", u, "contrasena", CONTRASENA_VALIDA, "nombre", "M", "apellido", "X",
                        "email", u + "@matriz.test");
            }
            case "UsuarioActualizarRequest", "RolActualizarRequest", "PermisoActualizarRequest" ->
                    m("descripcion", "matriz");
            case "RolCrearRequest" -> m("nombre", unico("RMX").toUpperCase());
            case "PermisoCrearRequest" -> m("nombre", unico("PMX").toUpperCase());
            case "CambiarEstadoRequest" -> m("activo", true);
            case "CerrarSesionesRequest" -> m("motivo", "prueba");
            case "RolPermisoAsignarRequest" -> m("permisoId", Long.valueOf(ID_INEXISTENTE));
            case "UsuarioRolAsignarRequest" -> m("rolId", Long.valueOf(ID_INEXISTENTE));
            case "UsuarioPermisoOverrideRequest" -> m("permisoId", Long.valueOf(ID_INEXISTENTE), "otorgado", true);
            case "CambiarContrasenaRequest" -> m("contrasenaActual", "NoEsLaActual2026", "contrasenaNueva",
                    "OtraClave2026xy");
            case "LoginRequest" -> m("usuario", "x", "contrasena", "y");
            default -> throw new AssertionError("Agrega un cuerpo valido para " + tipo.getName()
                    + " en MatrizAutorizacionTest.cuerpoValido");
        };
    }

    private Respuesta invocar(Endpoint e, String token) {
        return llamar(e.metodo(), e.rutaConcreta(), cuerpoValido(e.cuerpo()), token);
    }

    private UsuarioPrueba usuarioCon(Set<String> permisos) {
        String clave = String.join(",", new TreeSet<>(permisos));
        return USUARIOS_POR_PERMISOS.computeIfAbsent(clave, k -> crearUsuario(permisos.toArray(String[]::new)));
    }

    @Test
    void todosLosEndpointsDeLaApiTienenUnaReglaReconocida() {
        List<Endpoint> l = endpoints();
        assertThat(l).as("endpoints descubiertos").hasSizeGreaterThanOrEqualTo(48);
        assertThat(l).filteredOn(e -> e.tipo().startsWith("SIN_PREAUTHORIZE") || e.tipo().startsWith("NO_RECONOCIDA"))
                .as("endpoints sin @PreAuthorize o con expresion no soportada por la matriz").isEmpty();
        assertThat(l).filteredOn(e -> e.tipo().equals("PUBLICO")).extracting(Endpoint::ruta)
                .containsExactlyInAnyOrderElementsOf(PUBLICOS);
    }

    @TestFactory
    List<DynamicTest> sinTokenResponde401() {
        List<DynamicTest> t = new ArrayList<>();
        for (Endpoint e : endpoints()) {
            if (!e.tipo().equals("PUBLICO")) {
                t.add(dynamicTest("401 " + e, () -> esperarStatus(invocar(e, null), 401)));
            }
        }
        return t;
    }

    @TestFactory
    List<DynamicTest> usuarioSinPermisosResponde403() {
        List<DynamicTest> t = new ArrayList<>();
        for (Endpoint e : endpoints()) {
            if (e.tipo().equals("AUTORIDADES")) {
                t.add(dynamicTest("403 " + e + " " + e.autoridades(), () -> {
                    Respuesta r = invocar(e, usuarioCon(Set.of()).token());
                    esperarStatus(r, 403);
                    assertThat(r.json().path("mensaje").asString()).isNotBlank();
                }));
            }
        }
        return t;
    }

    @TestFactory
    List<DynamicTest> faltandoUnaDeVariasAutoridadesResponde403() {
        List<DynamicTest> t = new ArrayList<>();
        for (Endpoint e : endpoints()) {
            if (e.tipo().equals("AUTORIDADES") && e.autoridades().size() > 1) {
                for (String falta : e.autoridades()) {
                    Set<String> tiene = new LinkedHashSet<>(e.autoridades());
                    tiene.remove(falta);
                    t.add(dynamicTest("403 " + e + " sin " + falta,
                            () -> esperarStatus(invocar(e, usuarioCon(tiene).token()), 403)));
                }
            }
        }
        return t;
    }

    @TestFactory
    List<DynamicTest> conLasAutoridadesExactasNoHay401Ni403() {
        List<DynamicTest> t = new ArrayList<>();
        for (Endpoint e : endpoints()) {
            if (e.tipo().equals("AUTORIDADES") && !e.metodo().equals("DELETE") && !e.metodo().equals("POST")
                    && !e.metodo().equals("PUT") && !e.metodo().equals("PATCH")) {
                // Lecturas: un usuario con EXACTAMENTE los permisos declarados pasa la seguridad.
                t.add(dynamicTest("ok " + e + " con " + e.autoridades(), () -> {
                    Respuesta r = invocar(e, usuarioCon(new LinkedHashSet<>(e.autoridades())).token());
                    assertThat(r.status()).as("respuesta: %s", r).isNotIn(401, 403, 500);
                }));
            }
        }
        return t;
    }

    @TestFactory
    List<DynamicTest> administradorNoRecibe401Ni403() {
        List<DynamicTest> t = new ArrayList<>();
        for (Endpoint e : endpoints()) {
            if (e.tipo().equals("AUTORIDADES")) {
                t.add(dynamicTest("admin " + e, () -> {
                    Respuesta r = invocar(e, admin());
                    assertThat(r.status()).as("respuesta: %s", r).isNotIn(401, 403, 500);
                }));
            }
        }
        return t;
    }

    @TestFactory
    List<DynamicTest> endpointsAutenticadosAceptanCualquierToken() {
        List<DynamicTest> t = new ArrayList<>();
        for (Endpoint e : endpoints()) {
            if (e.tipo().equals("AUTENTICADO") && e.metodo().equals("GET")) {
                t.add(dynamicTest("ok " + e, () -> esperarStatus(invocar(e, usuarioCon(Set.of()).token()), 200)));
            }
        }
        return t;
    }
}
