package oracle.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import oracle.common.config.Transacciones;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Refresh tokens con rotacion (seguridad.sesiones_refresh).
 *
 * <ul>
 *   <li>Un login abre una FAMILIA; cada renovacion revoca el token usado
 *       (motivo ROTADO) y emite otro de la misma familia.</li>
 *   <li>Se guarda solo el SHA-256 del token (256 bits aleatorios): un volcado
 *       de la tabla no permite renovar sesiones.</li>
 *   <li>Vence por inactividad (expira_en) y nunca despues del maximo de la
 *       sesion desde el login (familia_expira_en).</li>
 *   <li>Reutilizar un token ya rotado = token robado: se revoca TODA la
 *       familia (motivo REUSO). Excepcion: dentro de la ventana de gracia
 *       (dos pestanas renovando a la vez) se emite un hermano en la familia.</li>
 *   <li>Cambio de contrasena, cierre forzado o desactivacion revocan la familia
 *       por trigger (motivo CREDENCIALES).</li>
 * </ul>
 */
@Slf4j
@Component
public class SesionesRefresh {

    private static final Pattern FORMATO = Pattern.compile("^[A-Za-z0-9_-]{43}$");
    private static final SecureRandom ALEATORIO = new SecureRandom();

    private final JdbcTemplate jdbc;
    private final Transacciones transacciones;
    private final Duration inactividad;
    private final Duration maximo;
    private final Duration gracia;

    public SesionesRefresh(
            JdbcTemplate jdbc,
            Transacciones transacciones,
            @Value("${app.refresh.inactividad-min:120}") long inactividadMin,
            @Value("${app.refresh.max-horas:12}") long maxHoras,
            @Value("${app.refresh.gracia-seg:20}") long graciaSeg) {
        this.jdbc = jdbc;
        this.transacciones = transacciones;
        this.inactividad = Duration.ofMinutes(inactividadMin);
        this.maximo = Duration.ofHours(maxHoras);
        this.gracia = Duration.ofSeconds(graciaSeg);
        if (inactividad.isNegative() || inactividad.isZero() || maximo.compareTo(inactividad) < 0) {
            throw new IllegalStateException("app.refresh: la inactividad debe ser > 0 y <= al maximo de la sesion.");
        }
    }

    /** Token entregado al cliente (cookie) y vencimiento de su familia. */
    public record Emitido(String token, Instant familiaExpiraEn) {
    }

    /** Resultado de una renovacion: o un token nuevo, o el motivo del rechazo. */
    public record Rotacion(Long usuarioId, Emitido emitido, String rechazo, boolean reuso) {
        boolean ok() {
            return emitido != null;
        }
    }

    /** Abre una familia nueva (login). */
    public Emitido abrir(Long usuarioId, String ip, String userAgent) {
        Instant ahora = Instant.now();
        return insertar(usuarioId, UUID.randomUUID(), ahora.plus(maximo), ip, userAgent, ahora);
    }

    /**
     * Valida y rota el token. Bloquea la fila (FOR UPDATE) para que dos
     * renovaciones simultaneas del mismo token no emitan dos sucesores libres.
     * Nunca lanza por token invalido: devuelve el motivo (y la revocacion por
     * REUSO queda confirmada aunque la peticion termine en 401).
     */
    public Rotacion rotar(String token, String ip, String userAgent) {
        if (token == null || !FORMATO.matcher(token).matches()) {
            return new Rotacion(null, null, "formato", false);
        }
        String hash = hash(token);
        return transacciones.ejecutar(() -> {
            List<Fila> filas = jdbc.query("""
                    SELECT id, usuario_id, familia, expira_en, familia_expira_en, revocado_en, motivo_revocacion
                    FROM sesiones_refresh WHERE token_hash = ? FOR UPDATE""",
                    (rs, i) -> new Fila(rs.getLong("id"), rs.getLong("usuario_id"), rs.getObject("familia", UUID.class),
                            instante(rs.getObject("expira_en", OffsetDateTime.class)),
                            instante(rs.getObject("familia_expira_en", OffsetDateTime.class)),
                            instante(rs.getObject("revocado_en", OffsetDateTime.class)),
                            rs.getString("motivo_revocacion")),
                    hash);
            if (filas.isEmpty()) {
                return new Rotacion(null, null, "desconocido", false);
            }
            Fila f = filas.getFirst();
            Instant ahora = Instant.now();

            // Una familia cerrada (logout, credenciales, reuso) no revive por ningun camino.
            Boolean cerrada = jdbc.queryForObject("""
                    SELECT EXISTS (SELECT 1 FROM sesiones_refresh
                                   WHERE familia = ? AND motivo_revocacion IN ('LOGOUT', 'CREDENCIALES', 'REUSO'))""",
                    Boolean.class, f.familia());
            if (Boolean.TRUE.equals(cerrada)) {
                return new Rotacion(f.usuarioId(), null, "familia_revocada", false);
            }
            if (!ahora.isBefore(f.familiaExpiraEn())) {
                return new Rotacion(f.usuarioId(), null, "sesion_maxima_vencida", false);
            }
            if (f.revocadoEn() != null) {
                boolean enGracia = "ROTADO".equals(f.motivo()) && f.revocadoEn().plus(gracia).isAfter(ahora);
                if (!enGracia) {
                    int n = revocarFamilia(f.familia(), "REUSO");
                    log.warn("Refresh token reutilizado: familia {} del usuario {} revocada ({} tokens).",
                            f.familia(), f.usuarioId(), n);
                    return new Rotacion(f.usuarioId(), null, "reutilizado", true);
                }
                // Carrera legitima (otra pestana renovo hace segundos): hermano en la misma familia.
                return new Rotacion(f.usuarioId(),
                        insertar(f.usuarioId(), f.familia(), f.familiaExpiraEn(), ip, userAgent, ahora), null, false);
            }
            if (!ahora.isBefore(f.expiraEn())) {
                return new Rotacion(f.usuarioId(), null, "inactividad", false);
            }
            jdbc.update("UPDATE sesiones_refresh SET revocado_en = ?, motivo_revocacion = 'ROTADO' WHERE id = ?",
                    utc(ahora), f.id());
            return new Rotacion(f.usuarioId(),
                    insertar(f.usuarioId(), f.familia(), f.familiaExpiraEn(), ip, userAgent, ahora), null, false);
        });
    }

    /** Logout: revoca la familia del token presentado (si existe). Devuelve el usuario o null. */
    public Long cerrar(String token) {
        if (token == null || !FORMATO.matcher(token).matches()) {
            return null;
        }
        return transacciones.ejecutar(() -> {
            List<Object[]> filas = jdbc.query("SELECT usuario_id, familia FROM sesiones_refresh WHERE token_hash = ?",
                    (rs, i) -> new Object[] {rs.getLong(1), rs.getObject(2, UUID.class)}, hash(token));
            if (filas.isEmpty()) {
                return null;
            }
            revocarFamilia((UUID) filas.getFirst()[1], "LOGOUT");
            return (Long) filas.getFirst()[0];
        });
    }

    /** Borra familias vencidas hace mas de un dia (cada hora, por lotes). */
    @Scheduled(initialDelay = 600_000, fixedDelay = 3_600_000)
    void purgarVencidas() {
        try {
            int total = 0;
            int n;
            do {
                n = jdbc.update("""
                        DELETE FROM sesiones_refresh WHERE id IN (
                          SELECT id FROM sesiones_refresh WHERE familia_expira_en < now() - interval '1 day' LIMIT 5000)""");
                total += n;
            } while (n == 5000);
            if (total > 0) {
                log.info("Purga de refresh tokens: {} filas vencidas eliminadas.", total);
            }
        } catch (RuntimeException ex) {
            log.warn("Fallo la purga de refresh tokens: {}", ex.getMessage());
        }
    }

    public Duration maximo() {
        return maximo;
    }

    private int revocarFamilia(UUID familia, String motivo) {
        return jdbc.update("""
                UPDATE sesiones_refresh SET revocado_en = now(), motivo_revocacion = ?
                WHERE familia = ? AND revocado_en IS NULL""", motivo, familia);
    }

    private Emitido insertar(Long usuarioId, UUID familia, Instant familiaExpira, String ip, String ua, Instant ahora) {
        byte[] bytes = new byte[32];
        ALEATORIO.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expira = ahora.plus(inactividad);
        if (expira.isAfter(familiaExpira)) {
            expira = familiaExpira;
        }
        jdbc.update("""
                INSERT INTO sesiones_refresh (usuario_id, familia, token_hash, expira_en, familia_expira_en, ip, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?)""",
                usuarioId, familia, hash(token), utc(expira), utc(familiaExpira), truncar(ip, 45), truncar(ua, 255));
        return new Emitido(token, familiaExpira);
    }

    static String hash(String token) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.US_ASCII));
            return HexFormat.of().formatHex(h);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static OffsetDateTime utc(Instant i) {
        return OffsetDateTime.ofInstant(i, ZoneOffset.UTC);
    }

    private static Instant instante(OffsetDateTime t) {
        return t == null ? null : t.toInstant();
    }

    private static String truncar(String v, int max) {
        if (v == null) {
            return null;
        }
        String limpio = v.replaceAll("\\p{Cntrl}", " ");
        return limpio.length() > max ? limpio.substring(0, max) : limpio;
    }

    private record Fila(long id, long usuarioId, UUID familia, Instant expiraEn, Instant familiaExpiraEn,
            Instant revocadoEn, String motivo) {
    }
}
