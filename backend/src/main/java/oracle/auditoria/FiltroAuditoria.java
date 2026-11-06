package oracle.auditoria;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import oracle.common.exception.PeticionInvalidaException;
import oracle.common.support.CondicionSql;

/**
 * Filtro ya validado y normalizado. Construye el WHERE SOLO con las condiciones
 * informadas (nada de "(:x IS NULL OR col = :x)", que impide elegir indice).
 */
final class FiltroAuditoria {

    /** Rango por defecto cuando no se acota por fecha ni por un filtro selectivo. */
    static final Duration RANGO_POR_DEFECTO = Duration.ofDays(30);

    private static final Pattern ID_NUMERICO = Pattern.compile("^\\d{1,19}$");
    private static final int MAX_Q = 100;

    private final Instant desde;
    private final Instant hastaExclusivo;
    private final Long actorId;
    private final List<String> acciones;
    private final List<String> entidades;
    private final String entidadId;
    private final List<String> resultados;
    private final String q;
    private final String relacionTipo;
    private final String relacionId;

    private FiltroAuditoria(Instant desde, Instant hastaExclusivo, Long actorId, List<String> acciones,
            List<String> entidades, String entidadId, List<String> resultados, String q,
            String relacionTipo, String relacionId) {
        this.desde = desde;
        this.hastaExclusivo = hastaExclusivo;
        this.actorId = actorId;
        this.acciones = acciones;
        this.entidades = entidades;
        this.entidadId = entidadId;
        this.resultados = resultados;
        this.q = q;
        this.relacionTipo = relacionTipo;
        this.relacionId = relacionId;
    }

    static FiltroAuditoria de(AuditoriaFiltroRequest p, Instant ahora) {
        Instant desde = fecha(p.desde(), "desde", false);
        Instant hasta = fecha(p.hasta(), "hasta", true);
        if (desde != null && hasta != null && !desde.isBefore(hasta)) {
            throw new PeticionInvalidaException("La fecha 'desde' debe ser anterior a 'hasta'.");
        }
        List<String> acciones = lista(p.accion(), AccionAuditoria.class, "accion");
        List<String> entidades = lista(p.entidad(), EntidadAuditoria.class, "entidad");
        List<String> resultados = lista(p.resultado(), ResultadoAuditoria.class, "resultado");
        String entidadId = texto(p.entidadId(), 64);
        String q = texto(p.q(), MAX_Q);

        String relTipo = null;
        String relId = null;
        String rel = texto(p.relacionadoCon(), 80);
        if (rel != null) {
            int sep = rel.indexOf(':');
            if (sep <= 0 || sep == rel.length() - 1) {
                throw new PeticionInvalidaException("relacionadoCon debe tener el formato TIPO:id (p. ej. USUARIO:42).");
            }
            relTipo = rel.substring(0, sep).toUpperCase(Locale.ROOT);
            relId = rel.substring(sep + 1);
            valorDe(EntidadAuditoria.class, relTipo, "relacionadoCon");
            if (!ID_NUMERICO.matcher(relId).matches()) {
                throw new PeticionInvalidaException("El id de relacionadoCon debe ser numérico.");
            }
        }

        // Sin fechas ni filtro selectivo: ultimos 30 dias (protege la consulta y el COUNT).
        boolean selectivo = p.actorId() != null || entidadId != null || relTipo != null;
        if (desde == null && hasta == null && !selectivo) {
            desde = ahora.minus(RANGO_POR_DEFECTO);
        }
        return new FiltroAuditoria(desde, hasta, p.actorId(), acciones, entidades, entidadId, resultados, q,
                relTipo, relId);
    }

    /** WHERE parametrizado con solo los filtros presentes. */
    CondicionSql condicion() {
        List<String> partes = new ArrayList<>();
        List<Object> args = new ArrayList<>();
        if (desde != null) {
            partes.add("ocurrido_en >= ?");
            args.add(OffsetDateTime.ofInstant(desde, ZoneOffset.UTC));
        }
        if (hastaExclusivo != null) {
            partes.add("ocurrido_en < ?");
            args.add(OffsetDateTime.ofInstant(hastaExclusivo, ZoneOffset.UTC));
        }
        if (actorId != null) {
            partes.add("actor_id = ?");
            args.add(actorId);
        }
        en(partes, args, "accion", acciones, "text");
        en(partes, args, "entidad", entidades, "text");
        if (entidadId != null) {
            partes.add("entidad_id = ?");
            args.add(entidadId);
        }
        en(partes, args, "resultado", resultados, "resultado_auditoria");
        if (q != null) {
            // Prefijo sin mayusculas sobre el login (idx_auditoria_actor_usuario); exacto sobre id y correlacion.
            partes.add("(lower(actor_usuario) LIKE ? ESCAPE '!' OR entidad_id = ? OR id_correlacion = ?)");
            args.add(escaparLike(q.toLowerCase(Locale.ROOT)) + "%");
            args.add(q);
            args.add(q);
        }
        if (relacionTipo != null) {
            relacion(partes, args);
        }
        String where = partes.isEmpty() ? "" : "WHERE " + String.join(" AND ", partes);
        return new CondicionSql(where, args);
    }

    /**
     * Eventos del propio registro o de relaciones cuyo id compuesto lo incluye.
     * USUARIO tambien incluye sus sesiones (logins).
     */
    private void relacion(List<String> partes, List<Object> args) {
        String id = relacionId;
        switch (relacionTipo) {
            case "USUARIO" -> {
                partes.add("((entidad IN ('USUARIO','SESION') AND entidad_id = ?)"
                        + " OR (entidad IN ('USUARIO_ROL','USUARIO_PERMISO') AND entidad_id LIKE ?))");
                args.add(id);
                args.add(id + ":%");
            }
            case "ROL" -> {
                partes.add("((entidad = 'ROL' AND entidad_id = ?)"
                        + " OR (entidad = 'USUARIO_ROL' AND entidad_id LIKE ?)"
                        + " OR (entidad = 'ROL_PERMISO' AND entidad_id LIKE ?))");
                args.add(id);
                args.add("%:" + id);
                args.add(id + ":%");
            }
            case "PERMISO" -> {
                partes.add("((entidad = 'PERMISO' AND entidad_id = ?)"
                        + " OR (entidad IN ('ROL_PERMISO','USUARIO_PERMISO') AND entidad_id LIKE ?))");
                args.add(id);
                args.add("%:" + id);
            }
            default -> {
                partes.add("(entidad = ? AND entidad_id = ?)");
                args.add(relacionTipo);
                args.add(id);
            }
        }
    }

    /** Filtros efectivos (para el evento AUDITORIA_EXPORTADA). */
    Map<String, Object> resumen() {
        Map<String, Object> m = new LinkedHashMap<>();
        Detalle.con(m, "desde", desde == null ? null : desde.toString());
        Detalle.con(m, "hasta", hastaExclusivo == null ? null : hastaExclusivo.toString());
        Detalle.con(m, "actorId", actorId);
        Detalle.con(m, "accion", acciones.isEmpty() ? null : acciones);
        Detalle.con(m, "entidad", entidades.isEmpty() ? null : entidades);
        Detalle.con(m, "entidadId", entidadId);
        Detalle.con(m, "resultado", resultados.isEmpty() ? null : resultados);
        Detalle.con(m, "q", q);
        Detalle.con(m, "relacionadoCon", relacionTipo == null ? null : relacionTipo + ":" + relacionId);
        return m;
    }

    /** Uno o varios valores en UN parametro de tipo array: columna = ANY(?::tipo[]). */
    private static void en(List<String> partes, List<Object> args, String columna, List<String> valores,
            String tipo) {
        if (valores.isEmpty()) {
            return;
        }
        if (valores.size() == 1) {
            partes.add(columna + " = ?::" + tipo);
            args.add(valores.getFirst());
        } else {
            partes.add(columna + " = ANY (?::" + tipo + "[])");
            args.add(valores.toArray(String[]::new));
        }
    }

    private static String escaparLike(String v) {
        return v.replace("!", "!!").replace("%", "!%").replace("_", "!_");
    }

    private static String texto(String v, int max) {
        if (v == null || v.isBlank()) {
            return null;
        }
        String t = v.trim();
        if (t.length() > max) {
            throw new PeticionInvalidaException("Un filtro de texto supera el largo máximo de " + max + " caracteres.");
        }
        return t;
    }

    private static <E extends Enum<E>> List<String> lista(String v, Class<E> tipo, String campo) {
        if (v == null || v.isBlank()) {
            return List.of();
        }
        return Arrays.stream(v.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> valorDe(tipo, s.toUpperCase(Locale.ROOT), campo))
                .distinct()
                .toList();
    }

    private static <E extends Enum<E>> String valorDe(Class<E> tipo, String valor, String campo) {
        try {
            return Enum.valueOf(tipo, valor).name();
        } catch (IllegalArgumentException ex) {
            throw new PeticionInvalidaException("Valor no admitido en '" + campo + "': " + recortar(valor) + ".");
        }
    }

    private static String recortar(String v) {
        String limpio = v.replaceAll("[^A-Za-z0-9_:-]", "");
        return limpio.length() > 40 ? limpio.substring(0, 40) : limpio;
    }

    /** ISO con zona, ISO sin zona (UTC) o fecha sola (inicio de dia / fin de dia exclusivo). */
    private static Instant fecha(String v, String campo, boolean esHasta) {
        if (v == null || v.isBlank()) {
            return null;
        }
        String t = v.trim();
        try {
            if (t.length() <= 10) {
                LocalDate dia = LocalDate.parse(t);
                return (esHasta ? dia.plusDays(1) : dia).atStartOfDay().toInstant(ZoneOffset.UTC);
            }
            Instant instante;
            try {
                instante = OffsetDateTime.parse(t).toInstant();
            } catch (DateTimeParseException sinZona) {
                instante = LocalDateTime.parse(t).toInstant(ZoneOffset.UTC);
            }
            // 'hasta' con hora es inclusivo: se pasa a limite exclusivo sumando 1 microsegundo.
            return esHasta ? instante.plusNanos(1_000) : instante;
        } catch (DateTimeParseException ex) {
            throw new PeticionInvalidaException("La fecha '" + campo + "' no tiene un formato ISO-8601 válido.");
        }
    }
}
