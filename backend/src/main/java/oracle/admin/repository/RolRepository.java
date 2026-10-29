package oracle.admin.repository;

import java.util.List;
import java.util.Optional;
import oracle.admin.model.Rol;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RolRepository extends JpaRepository<Rol, Long> {

    Optional<Rol> findByNombre(String nombre);

    boolean existsByNombre(String nombre);

    boolean existsByNombreAndIdNot(String nombre, Long id);

    /** Listado con filtros LIKE opcionales (sin LOWER: la collation ya ignora mayusculas). */
    @Query("""
            SELECT r FROM Rol r
            WHERE (:nombre IS NULL OR r.nombre LIKE CONCAT('%', :nombre, '%'))
              AND (:descripcion IS NULL OR r.descripcion LIKE CONCAT('%', :descripcion, '%'))
              AND (:activo IS NULL OR r.activo = :activo)
            """)
    List<Rol> buscarConFiltros(
            @Param("nombre") String nombre,
            @Param("descripcion") String descripcion,
            @Param("activo") Boolean activo,
            Pageable pagina);
}
