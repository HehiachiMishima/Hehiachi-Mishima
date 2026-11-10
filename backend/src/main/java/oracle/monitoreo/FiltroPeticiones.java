package oracle.monitoreo;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import oracle.common.exception.PeticionInvalidaException;
import oracle.common.support.CondicionSql;

/**
 * Filtros de GET /api/monitoreo/peticiones, validados. Solo se agregan al
 * WHERE las condiciones informadas para que PostgreSQL use el indice adecuado.
 *
 * @param estado "2xx" | "3xx" | "4xx" | "5xx" | "errores" | un codigo exacto (p. ej. 403)
 */
public record FiltroPeticiones(
        String desde,
        String hasta,
        Long actorId,
        String metodo,
        String ruta,
        String estado,
        Long minMs,
        String idCorrelacion,
        Integer pagina,
        Integer tamano) {

    static final Duration RANGO_POR_DEFECTO = Duration.ofDays(7);
    private static final Set<String> METODOS = Set.of("GET", "POST", "PUT", "PATCH", "DELETE");
    private static final Pattern CORRELACION = Pattern.compile("^[A-Za-z0-9_-]{1,64}$");
    private static final Pattern CODIGO = Pattern.compile("^[1-5]\\d\\d$");

    CondicionSql condicion(Instant ahora) {
        List<String> c = new ArrayList<>();
        List<Object> a = new ArrayList<>();
        Instant d = fecha(desde, "desde");
        Instant h = fecha(hasta, "hasta");
        if (d != null && h != null && !d.isBefore(h)) {
            throw new PeticionInvalidaException("La fecha 'desde' debe ser anterior a 'hasta'.");
        }
        String corr = idCorrelacion == null || idCorrelacion.isBlank() ? null : idCorrelacion.trim();
        if (corr != null && !CORRELACION.matcher(corr).matches()) {
            throw new PeticionInvalidaException("El identificador de petición no es válido.");
        }
        // Sin fechas ni filtro selectivo se acota a 7 dias (la tabla puede ser grande).
        if (d == null && corr == null) {
            d = ahora.minus(RANGO_POR_DEFECTO);
        }
        if (d != null) {
            c.add("p.ocurrido_en >= ?");
            a.add(OffsetDateTime.ofInstant(d, ZoneOffset.UTC));
        }
        if (h != null) {
            c.add("p.ocurrido_en < ?");
            a.add(OffsetDateTime.ofInstant(h, ZoneOffset.UTC));
        }
        if (actorId != null) {
            c.add("p.actor_id = ?");
            a.add(actorId);
        }
        if (metodo != null && !metodo.isBlank()) {
            String m = metodo.trim().toUpperCase(Locale.ROOT);
            if (!METODOS.contains(m)) {
                throw new PeticionInvalidaException("Método HTTP no válido.");
            }
            c.add("p.metodo = ?");
            a.add(m);
        }
        if (ruta != null && !ruta.isBlank()) {
            String r = ruta.trim();
            if (r.length() > 200) {
                throw new PeticionInvalidaException("La ruta no puede superar 200 caracteres.");
            }
            c.add("p.ruta = ?");
            a.add(r);
        }
        if (estado != null && !estado.isBlank()) {
            String e = estado.trim().toLowerCase(Locale.ROOT);
            switch (e) {
                case "errores" -> c.add("p.estado >= 400");
                case "2xx", "3xx", "4xx", "5xx" -> {
                    int base = (e.charAt(0) - '0') * 100;
                    c.add("p.estado >= ? AND p.estado < ?");
                    a.add(base);
                    a.add(base + 100);
                }
                default -> {
                    if (!CODIGO.matcher(e).matches()) {
                        throw new PeticionInvalidaException("Estado no válido: usa 2xx, 3xx, 4xx, 5xx, errores o un código.");
                    }
                    c.add("p.estado = ?");
                    a.add(Integer.parseInt(e));
                }
            }
        }
        if (minMs != null) {
            if (minMs < 0) {
                throw new PeticionInvalidaException("La duración mínima no puede ser negativa.");
            }
            c.add("p.duracion_ms >= ?");
            a.add(minMs);
        }
        if (corr != null) {
            c.add("p.id_correlacion = ?");
            a.add(corr);
        }
        return new CondicionSql(c.isEmpty() ? "" : "WHERE " + String.join(" AND ", c), a);
    }

    private static Instant fecha(String valor, String campo) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(valor.trim()).toInstant();
        } catch (DateTimeParseException ex) {
            try {
                return Instant.parse(valor.trim());
            } catch (DateTimeParseException ex2) {
                throw new PeticionInvalidaException("La fecha '" + campo + "' debe ser ISO-8601 con zona (p. ej. 2026-01-31T10:00:00Z).");
            }
        }
    }
}
