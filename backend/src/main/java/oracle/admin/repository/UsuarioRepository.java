package oracle.admin.repository;

import java.util.List;
import java.util.Optional;
import oracle.admin.model.Usuario;
import oracle.common.support.Especificaciones;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long>, JpaSpecificationExecutor<Usuario> {

    // Unicidad y login sin distinguir mayusculas: lower(...) coincide con los
    // indices unicos funcionales uq_usuarios_usuario_ci / uq_usuarios_email_ci.

    /** Login por nombre de usuario (se busca primero; ver AuthService). */
    @Query("SELECT u FROM Usuario u WHERE lower(u.usuario) = lower(:usuario)")
    Optional<Usuario> findByUsuario(@Param("usuario") String usuario);

    /** Login por email (si no hubo coincidencia por usuario). */
    @Query("SELECT u FROM Usuario u WHERE lower(u.email) = lower(:email)")
    Optional<Usuario> findByEmail(@Param("email") String email);

    @Query("SELECT COUNT(u) > 0 FROM Usuario u WHERE lower(u.usuario) = lower(:usuario)")
    boolean existsByUsuario(@Param("usuario") String usuario);

    @Query("SELECT COUNT(u) > 0 FROM Usuario u WHERE lower(u.email) = lower(:email)")
    boolean existsByEmail(@Param("email") String email);

    @Query("SELECT COUNT(u) > 0 FROM Usuario u WHERE lower(u.email) = lower(:email) AND u.id <> :id")
    boolean existsByEmailAndIdNot(@Param("email") String email, @Param("id") Long id);

    @Query("SELECT COUNT(u) > 0 FROM Usuario u WHERE lower(u.usuario) = lower(:usuario) AND u.id <> :id")
    boolean existsByUsuarioAndIdNot(@Param("usuario") String usuario, @Param("id") Long id);

    /**
     * Listado con filtros "contiene" opcionales combinados con AND. Solo las
     * condiciones informadas entran en el WHERE (ILIKE acelerado por el indice
     * GIN de trigramas); LIMIT del Pageable, sin consulta COUNT.
     */
    default List<Usuario> buscarConFiltros(String usuario, String nombre, String apellido, String email, Boolean activo, Pageable pagina) {
        Specification<Usuario> filtro = Especificaciones.todas(
                Especificaciones.contiene("usuario", usuario),
                Especificaciones.contiene("nombre", nombre),
                Especificaciones.contiene("apellido", apellido),
                Especificaciones.contiene("email", email),
                Especificaciones.igual("activo", activo));
        return findBy(filtro, q -> q.sortBy(pagina.getSort()).limit(pagina.getPageSize()).all());
    }

    /** Ids ordenados (resumen por lotes). */
    @Query("SELECT u.id FROM Usuario u ORDER BY u.id")
    List<Long> ids(Pageable pagina);

    /** True si la cuenta tiene un bloqueo temporal vigente (comparado en la BD, sin desfase de zona). */
    @Query(value = "SELECT COUNT(*) FROM usuarios WHERE id = :id AND bloqueado_hasta > now()", nativeQuery = true)
    long contarBloqueoVigente(@Param("id") Long id);

    /**
     * Suma un fallo de forma atomica y, desde el umbral, bloquea con espera
     * exponencial (1, 2, 4... min, con tope). En PostgreSQL todas las
     * expresiones del SET ven la fila ANTERIOR: por eso el nuevo total se
     * escribe como intentos_fallidos + 1 tambien en el calculo del bloqueo.
     */
    @Transactional
    @Modifying
    @Query(value = """
            UPDATE usuarios
               SET intentos_fallidos = intentos_fallidos + 1,
                   bloqueado_hasta = CASE
                       WHEN intentos_fallidos + 1 >= :umbral
                       THEN now() + make_interval(mins => LEAST(
                                (2 ^ LEAST(intentos_fallidos + 1 - :umbral, 10))::int, :maxMinutos))
                       ELSE bloqueado_hasta
                   END
             WHERE id = :id
            """, nativeQuery = true)
    int registrarFallo(@Param("id") Long id, @Param("umbral") int umbral, @Param("maxMinutos") int maxMinutos);

    /** Reinicia los contadores tras un login correcto (no escribe si ya estaban a cero). */
    @Transactional
    @Modifying
    @Query(value = """
            UPDATE usuarios
               SET intentos_fallidos = 0, bloqueado_hasta = NULL
             WHERE id = :id AND (intentos_fallidos <> 0 OR bloqueado_hasta IS NOT NULL)
            """, nativeQuery = true)
    int reiniciarIntentos(@Param("id") Long id);
}
