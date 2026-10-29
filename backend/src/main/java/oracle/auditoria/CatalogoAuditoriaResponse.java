package oracle.auditoria;

import java.util.List;

/** Valores admitidos por los filtros de la bitacora. */
public record CatalogoAuditoriaResponse(List<String> acciones, List<String> entidades, List<String> resultados) {
}
