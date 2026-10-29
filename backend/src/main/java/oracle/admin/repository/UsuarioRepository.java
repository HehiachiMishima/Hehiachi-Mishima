package oracle.admin.repository;

import java.util.List;
import java.util.Optional;
import oracle.admin.model.Usuario;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    /** Login por nombre de usuario (se busca primero; ver AuthService). */
    Optional<Usuario> findByUsuario(String usuario);

    /** Login por email (si no hubo coincidencia por usuario). */
    Optional<Usuario> findByEmail(String email);

    boolean existsByUsuario(String usuario);

    boolean existsByEmail(String email);

    boolean existsByEmailAndIdNot(String email, Long id);

    boolean existsByUsuarioAndIdNot(String usuario, Long id);

    /**
     * Listado con filtros LIKE opcionales y combinados con AND. Sin LOWER(): la
     * collation utf8mb4_unicode_ci ya ignora mayusculas. Acotado por Pageable.
     */
    @Query("""
            SELECT u FROM Usuario u
            WHERE (:usuario IS NULL OR u.usuario LIKE CONCAT('%', :usuario, '%'))
              AND (:nombre IS NULL OR u.nombre LIKE CONCAT('%', :nombre, '%'))
              AND (:apellido IS NULL OR u.apellido LIKE CONCAT('%', :apellido, '%'))
              AND (:email IS NULL OR u.email LIKE CONCAT('%', :email, '%'))
              AND (:activo IS NULL OR u.activo = :activo)
            """)
    List<Usuario> buscarConFiltros(
            @Param("usuario") String usuario,
            @Param("nombre") String nombre,
            @Param("apellido") String apellido,
            @Param("email") String email,
            @Param("activo") Boolean activo,
            Pageable pagina);

    /** Ids ordenados (resumen por lotes). */
    @Query("SELECT u.id FROM Usuario u ORDER BY u.id")
    List<Long> ids(Pageable pagina);

    /** True si la cuenta tiene un bloqueo temporal vigente (comparado en la BD, sin desfase de zona). */
    @Query(value = "SELECT COUNT(*) FROM usuarios WHERE id = :id AND bloqueado_hasta > NOW(6)", nativeQuery = true)
    long contarBloqueoVigente(@Param("id") Long id);

    /**
     * Suma un fallo de forma atomica y, desde el umbral, bloquea con espera
     * exponencial (1, 2, 4... min, con tope). MySQL evalua las asignaciones de
     * izquierda a derecha: en la segunda, intentos_fallidos ya vale el nuevo
     * valor. actualizado_en = actualizado_en evita el ON UPDATE automatico.
     */
    @Transactional
    @Modifying
    @Query(value = """
            UPDATE usuarios
               SET intentos_fallidos = intentos_fallidos + 1,
                   bloqueado_hasta = IF(intentos_fallidos >= :umbral,
                       NOW(6) + INTERVAL LEAST(CAST(POW(2, LEAST(intentos_fallidos - :umbral, 10)) AS UNSIGNED),
                                               :maxMinutos) MINUTE,
                       bloqueado_hasta),
                   actualizado_en = actualizado_en
             WHERE id = :id
            """, nativeQuery = true)
    int registrarFallo(@Param("id") Long id, @Param("umbral") int umbral, @Param("maxMinutos") int maxMinutos);

    /** Reinicia los contadores tras un login correcto (no escribe si ya estaban a cero). */
    @Transactional
    @Modifying
    @Query(value = """
            UPDATE usuarios
               SET intentos_fallidos = 0, bloqueado_hasta = NULL, actualizado_en = actualizado_en
             WHERE id = :id AND (intentos_fallidos <> 0 OR bloqueado_hasta IS NOT NULL)
            """, nativeQuery = true)
    int reiniciarIntentos(@Param("id") Long id);
}
