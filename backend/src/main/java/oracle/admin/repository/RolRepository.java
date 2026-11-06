package oracle.admin.repository;

import java.util.List;
import java.util.Optional;
import oracle.admin.model.Rol;
import oracle.common.support.Especificaciones;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RolRepository extends JpaRepository<Rol, Long>, JpaSpecificationExecutor<Rol> {

    @Query("SELECT r FROM Rol r WHERE lower(r.nombre) = lower(:nombre)")
    Optional<Rol> findByNombre(@Param("nombre") String nombre);

    /** Unicidad sin distinguir mayusculas (mismo criterio que uq_roles_nombre_ci). */
    @Query("SELECT COUNT(r) > 0 FROM Rol r WHERE lower(r.nombre) = lower(:nombre)")
    boolean existsByNombre(@Param("nombre") String nombre);

    @Query("SELECT COUNT(r) > 0 FROM Rol r WHERE lower(r.nombre) = lower(:nombre) AND r.id <> :id")
    boolean existsByNombreAndIdNot(@Param("nombre") String nombre, @Param("id") Long id);

    /**
     * Listado con filtros "contiene" opcionales combinados con AND. Solo las
     * condiciones informadas entran en el WHERE (ILIKE acelerado por el indice
     * GIN de trigramas); LIMIT del Pageable, sin consulta COUNT.
     */
    default List<Rol> buscarConFiltros(String nombre, String descripcion, Boolean activo, Pageable pagina) {
        Specification<Rol> filtro = Especificaciones.todas(
                Especificaciones.contiene("nombre", nombre),
                Especificaciones.contiene("descripcion", descripcion),
                Especificaciones.igual("activo", activo));
        return findBy(filtro, q -> q.sortBy(pagina.getSort()).limit(pagina.getPageSize()).all());
    }
}
