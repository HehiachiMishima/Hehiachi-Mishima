package oracle.admin.repository;

import java.util.List;
import oracle.admin.model.Permiso;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PermisoRepository extends JpaRepository<Permiso, Long> {

    boolean existsByNombre(String nombre);

    boolean existsByNombreAndIdNot(String nombre, Long id);

    /** Listado con filtros LIKE opcionales (sin LOWER: la collation ya ignora mayusculas). */
    @Query("""
            SELECT p FROM Permiso p
            WHERE (:nombre IS NULL OR p.nombre LIKE CONCAT('%', :nombre, '%'))
              AND (:descripcion IS NULL OR p.descripcion LIKE CONCAT('%', :descripcion, '%'))
              AND (:activo IS NULL OR p.activo = :activo)
            """)
    List<Permiso> buscarConFiltros(
            @Param("nombre") String nombre,
            @Param("descripcion") String descripcion,
            @Param("activo") Boolean activo,
            Pageable pagina);
}
