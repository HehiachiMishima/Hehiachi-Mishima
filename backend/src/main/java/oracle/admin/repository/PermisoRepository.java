package oracle.admin.repository;

import java.util.List;
import oracle.admin.model.Permiso;
import oracle.common.support.Especificaciones;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PermisoRepository extends JpaRepository<Permiso, Long>, JpaSpecificationExecutor<Permiso> {

    /** Unicidad sin distinguir mayusculas (mismo criterio que uq_permisos_nombre_ci). */
    @Query("SELECT COUNT(p) > 0 FROM Permiso p WHERE lower(p.nombre) = lower(:nombre)")
    boolean existsByNombre(@Param("nombre") String nombre);

    @Query("SELECT COUNT(p) > 0 FROM Permiso p WHERE lower(p.nombre) = lower(:nombre) AND p.id <> :id")
    boolean existsByNombreAndIdNot(@Param("nombre") String nombre, @Param("id") Long id);

    /**
     * Listado con filtros "contiene" opcionales combinados con AND. Solo las
     * condiciones informadas entran en el WHERE (ILIKE acelerado por el indice
     * GIN de trigramas); LIMIT del Pageable, sin consulta COUNT.
     */
    default List<Permiso> buscarConFiltros(String nombre, String descripcion, Boolean activo, Pageable pagina) {
        Specification<Permiso> filtro = Especificaciones.todas(
                Especificaciones.contiene("nombre", nombre),
                Especificaciones.contiene("descripcion", descripcion),
                Especificaciones.igual("activo", activo));
        return findBy(filtro, q -> q.sortBy(pagina.getSort()).limit(pagina.getPageSize()).all());
    }
}
