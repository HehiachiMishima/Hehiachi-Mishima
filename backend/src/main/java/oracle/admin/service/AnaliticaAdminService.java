package oracle.admin.service;

import java.util.List;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import oracle.admin.repository.AnaliticaAdminRepository;
import oracle.admin.response.AnaliticaAdminResponse;
import oracle.common.config.CacheRespuestas;
import oracle.common.response.ApiResponse;
import oracle.common.support.EjecutorAnalitica;
import oracle.common.support.Trazas;
import org.springframework.stereotype.Service;

/** Dashboard ejecutivo de Administracion: 5 agregaciones en paralelo, cacheadas (TTL). */
@Slf4j
@Service
public class AnaliticaAdminService {

    private static final String CLAVE = "admin-analitica";

    private final AnaliticaAdminRepository repo;
    private final EjecutorAnalitica ejecutor;
    private final CacheRespuestas cacheRespuestas;

    public AnaliticaAdminService(AnaliticaAdminRepository repo, EjecutorAnalitica ejecutor,
            CacheRespuestas cacheRespuestas) {
        this.repo = repo;
        this.ejecutor = ejecutor;
        this.cacheRespuestas = cacheRespuestas;
    }

    public ApiResponse<AnaliticaAdminResponse> analitica() {
        AnaliticaAdminResponse datos = Trazas.medir(log, "AnaliticaAdminService.analitica", () ->
                cacheRespuestas.obtener(CLAVE, this::calcular));
        return ApiResponse.ok("Analítica calculada.", datos);
    }

    private AnaliticaAdminResponse calcular() {
        List<Supplier<?>> consultas = List.of(
                repo::kpis, repo::usuariosPorRol, repo::permisosMasOtorgados, repo::coberturaPaneles,
                repo::altasPorMes);
        List<Object> r = ejecutor.todas(consultas);
        return new AnaliticaAdminResponse((AnaliticaAdminResponse.Kpis) r.get(0),
                lista(r.get(1)), lista(r.get(2)), lista(r.get(3)), lista(r.get(4)));
    }

    @SuppressWarnings("unchecked")
    private static <T> List<T> lista(Object valor) {
        return (List<T>) valor;
    }
}
