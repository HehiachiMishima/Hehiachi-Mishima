package oracle.admin.repository;

import java.util.List;
import java.util.Optional;
import oracle.admin.model.UsuarioPermiso;
import oracle.admin.model.UsuarioPermiso.UsuarioPermisoId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface UsuarioPermisoRepository extends JpaRepository<UsuarioPermiso, UsuarioPermisoId> {

    Optional<UsuarioPermiso> findByUsuarioIdAndPermisoId(Long usuarioId, Long permisoId);

    boolean existsByUsuarioIdAndPermisoId(Long usuarioId, Long permisoId);

    /** Overrides del usuario con usuario y permiso cargados en la misma consulta (sin N+1). */
    @Query("""
            SELECT up FROM UsuarioPermiso up JOIN FETCH up.usuario JOIN FETCH up.permiso
            WHERE up.usuario.id = :usuarioId ORDER BY up.permiso.nombre
            """)
    List<UsuarioPermiso> deUsuario(@Param("usuarioId") Long usuarioId);

    /** Overrides grant (TRUE) o deny (FALSE) del usuario, sin N+1. */
    @Query("""
            SELECT up FROM UsuarioPermiso up JOIN FETCH up.usuario JOIN FETCH up.permiso
            WHERE up.usuario.id = :usuarioId AND up.otorgado = :otorgado ORDER BY up.permiso.nombre
            """)
    List<UsuarioPermiso> deUsuarioPorTipo(@Param("usuarioId") Long usuarioId, @Param("otorgado") Boolean otorgado);

    @Transactional
    @Modifying
    @Query("DELETE FROM UsuarioPermiso up WHERE up.usuario.id = :usuarioId AND up.permiso.id = :permisoId")
    void eliminarPar(@Param("usuarioId") Long usuarioId, @Param("permisoId") Long permisoId);
}
