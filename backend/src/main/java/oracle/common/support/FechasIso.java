package oracle.common.support;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import oracle.common.exception.PeticionInvalidaException;

/**
 * Lectura de fechas de filtros (query params) con UNA sola regla para toda la API:
 * <ul>
 *   <li>{@code 2026-01-31}: dia completo en UTC; en 'hasta' incluye todo ese dia.</li>
 *   <li>{@code 2026-01-31T10:00:00Z} o con offset {@code -05:00}: instante exacto.</li>
 *   <li>{@code 2026-01-31T10:00:00} (sin zona): se interpreta como UTC (lo que envia el frontend).</li>
 * </ul>
 * 'hasta' con hora es inclusivo (se convierte en limite exclusivo sumando 1 µs,
 * la precision de timestamptz). Fuera de [1970, 2100) se rechaza con 400: un
 * año extremo no debe llegar a PostgreSQL y convertirse en un 500.
 */
public final class FechasIso {

    public static final Instant MINIMO = Instant.parse("1970-01-01T00:00:00Z");
    public static final Instant MAXIMO = Instant.parse("2100-01-01T00:00:00Z");

    public static Instant leer(String valor, String campo, boolean esHasta) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        String t = valor.trim();
        Instant instante;
        try {
            if (t.length() <= 10) {
                LocalDate dia = LocalDate.parse(t);
                instante = (esHasta ? dia.plusDays(1) : dia).atStartOfDay().toInstant(ZoneOffset.UTC);
            } else {
                try {
                    instante = OffsetDateTime.parse(t).toInstant();
                } catch (DateTimeParseException sinOffset) {
                    try {
                        instante = Instant.parse(t);
                    } catch (DateTimeParseException sinZ) {
                        instante = LocalDateTime.parse(t).toInstant(ZoneOffset.UTC);
                    }
                }
                if (esHasta) {
                    instante = instante.plusNanos(1_000);
                }
            }
        } catch (DateTimeParseException | ArithmeticException ex) {
            throw new PeticionInvalidaException("La fecha '" + campo
                    + "' no tiene un formato válido (usa 2026-01-31 o 2026-01-31T10:00:00Z).");
        }
        if (instante.isBefore(MINIMO) || !instante.isBefore(MAXIMO)) {
            throw new PeticionInvalidaException("La fecha '" + campo + "' está fuera del rango admitido (1970–2099).");
        }
        return instante;
    }

    /** Zona IANA (America/Lima, Europe/Madrid...). Vacia = UTC. Invalida = 400. */
    public static ZoneId zona(String valor) {
        if (valor == null || valor.isBlank()) {
            return ZoneOffset.UTC;
        }
        String t = valor.trim();
        if (t.length() > 64) {
            throw new PeticionInvalidaException("La zona horaria no es válida.");
        }
        try {
            return ZoneId.of(t);
        } catch (DateTimeException ex) {
            throw new PeticionInvalidaException("La zona horaria '" + t + "' no es válida (usa p. ej. America/Lima).");
        }
    }

    private FechasIso() {
    }
}
