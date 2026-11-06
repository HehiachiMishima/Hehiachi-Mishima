package oracle.common.support;

import org.hibernate.query.criteria.HibernateCriteriaBuilder;
import org.springframework.data.jpa.domain.Specification;

/**
 * Filtros dinamicos para los listados: SOLO entran en el WHERE las condiciones
 * informadas. Sustituye al patron "(:x IS NULL OR col LIKE :x)", que en
 * PostgreSQL no puede tipar un parametro nulo y ademas impide usar indices.
 *
 * "Contiene" se traduce a ILIKE '%valor%' con los comodines del usuario
 * escapados, de modo que lo acelera el indice GIN de trigramas de la columna.
 */
public final class Especificaciones {

    private static final char ESCAPE = '\\';

    /** Conjuncion de las partes no nulas (sin partes: sin restriccion). */
    @SafeVarargs
    public static <T> Specification<T> todas(Specification<T>... partes) {
        Specification<T> resultado = Specification.unrestricted();
        for (Specification<T> parte : partes) {
            if (parte != null) {
                resultado = resultado.and(parte);
            }
        }
        return resultado;
    }

    /** {@code campo ILIKE '%valor%'}; null si no hay valor. */
    public static <T> Specification<T> contiene(String campo, String valor) {
        if (valor == null) {
            return null;
        }
        String patron = "%" + escaparLike(valor) + "%";
        return (raiz, consulta, cb) -> ((HibernateCriteriaBuilder) cb).ilike(raiz.get(campo), patron, ESCAPE);
    }

    /** {@code campo = valor}; null si no hay valor. */
    public static <T> Specification<T> igual(String campo, Object valor) {
        if (valor == null) {
            return null;
        }
        return (raiz, consulta, cb) -> cb.equal(raiz.get(campo), valor);
    }

    static String escaparLike(String valor) {
        return valor.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private Especificaciones() {
    }
}
