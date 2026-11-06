package oracle.auditoria;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.UncheckedIOException;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import oracle.common.config.Transacciones;
import oracle.common.exception.PeticionInvalidaException;
import oracle.common.exception.RecursoNoEncontradoException;
import oracle.common.response.ApiResponse;
import oracle.common.response.PaginaResponse;
import oracle.common.support.CondicionSql;
import oracle.common.support.Trazas;
import org.springframework.stereotype.Service;

/** Consulta y exportacion de la bitacora de auditoria (solo lectura). */
@Slf4j
@Service
public class AuditoriaService {

    static final int TAMANO_POR_DEFECTO = 25;
    static final int TAMANO_MAXIMO = 100;
    /** Tope del total devuelto y de la profundidad navegable (= tope del CSV). */
    static final int MAX_FILAS = 50_000;
    private static final int LOTE_EXPORTACION = 1_000;

    private static final String CABECERA_CSV = "id,ocurridoEn,actorId,actorUsuario,accion,entidad,entidadId,"
            + "resultado,ip,userAgent,idCorrelacion,detalle\r\n";

    private static final CatalogoAuditoriaResponse CATALOGO = new CatalogoAuditoriaResponse(
            nombres(AccionAuditoria.values()), nombres(EntidadAuditoria.values()), nombres(ResultadoAuditoria.values()));

    private final AuditoriaRepository repositorio;
    private final RegistroAuditoria registro;
    private final Transacciones transacciones;

    public AuditoriaService(AuditoriaRepository repositorio, RegistroAuditoria registro, Transacciones transacciones) {
        this.repositorio = repositorio;
        this.registro = registro;
        this.transacciones = transacciones;
    }

    public ApiResponse<PaginaResponse<AuditoriaEventoResponse>> listar(AuditoriaFiltroRequest peticion) {
        int pagina = peticion.pagina() == null ? 1 : peticion.pagina();
        int tamano = peticion.tamano() == null ? TAMANO_POR_DEFECTO : peticion.tamano();
        if (pagina < 1 || tamano < 1 || tamano > TAMANO_MAXIMO) {
            throw new PeticionInvalidaException("La página empieza en 1 y el tamaño debe estar entre 1 y "
                    + TAMANO_MAXIMO + ".");
        }
        long offset = (long) (pagina - 1) * tamano;
        if (offset >= MAX_FILAS) {
            throw new PeticionInvalidaException("Solo se pueden recorrer los primeros " + MAX_FILAS
                    + " eventos. Acota el rango de fechas o los filtros.");
        }
        CondicionSql condicion = FiltroAuditoria.de(peticion, Instant.now()).condicion();
        var p = Trazas.medir(log, "AuditoriaService.listar", () -> transacciones.consultar(() -> {
            List<AuditoriaEventoResponse> contenido = repositorio.pagina(condicion, (int) offset, tamano);
            long total = repositorio.contar(condicion, MAX_FILAS);
            return PaginaResponse.of(contenido, total, pagina, tamano);
        }));
        return ApiResponse.ok("Eventos de auditoría.", p);
    }

    public ApiResponse<AuditoriaEventoResponse> obtener(Long id) {
        var e = repositorio.porId(id)
            .orElseThrow(() -> new RecursoNoEncontradoException("No existe el evento de auditoría con id " + id + "."));
        return ApiResponse.ok("Evento de auditoría.", e);
    }

    public ApiResponse<CatalogoAuditoriaResponse> catalogo() {
        return ApiResponse.ok("Catálogo de auditoría.", CATALOGO);
    }

    /** Valida el filtro antes de abrir la respuesta (los errores salen como 400 JSON). */
    FiltroAuditoria validarExportacion(AuditoriaFiltroRequest peticion) {
        return FiltroAuditoria.de(peticion, Instant.now());
    }

    /**
     * Escribe el CSV en flujo, por lotes keyset de 1 000 filas, hasta MAX_FILAS.
     * Memoria constante; cada lote es una consulta corta. Registra AUDITORIA_EXPORTADA.
     */
    void exportar(FiltroAuditoria filtro, ContextoAuditoria ctx, OutputStream salida) {
        CondicionSql condicion = filtro.condicion();
        int filas = 0;
        try {
            Writer w = new BufferedWriter(new OutputStreamWriter(salida, StandardCharsets.UTF_8), 64 * 1024);
            w.write('﻿'); // BOM: Excel abre el UTF-8 con tildes correctas
            w.write(CABECERA_CSV);
            Instant ts = null;
            Long id = null;
            while (filas < MAX_FILAS) {
                int limite = Math.min(LOTE_EXPORTACION, MAX_FILAS - filas);
                List<AuditoriaEventoResponse> lote = repositorio.loteAnteriorA(condicion, ts, id, limite);
                for (AuditoriaEventoResponse e : lote) {
                    escribirFila(w, e);
                }
                filas += lote.size();
                if (lote.size() < limite) {
                    break;
                }
                AuditoriaEventoResponse ultimo = lote.getLast();
                ts = ultimo.ocurridoEn();
                id = ultimo.id();
                w.flush();
            }
            w.flush();
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        } finally {
            registro.exito(ctx, AccionAuditoria.AUDITORIA_EXPORTADA, null, null,
                    Detalle.con(Detalle.de("filtros", filtro.resumen()), "filas", filas));
        }
    }

    private static void escribirFila(Writer w, AuditoriaEventoResponse e) throws IOException {
        w.write(String.join(",",
                CeldaCsv.de(e.id()),
                CeldaCsv.de(e.ocurridoEn()),
                CeldaCsv.de(e.actorId()),
                CeldaCsv.de(e.actorUsuario()),
                CeldaCsv.de(e.accion()),
                CeldaCsv.de(e.entidad()),
                CeldaCsv.de(e.entidadId()),
                CeldaCsv.de(e.resultado()),
                CeldaCsv.de(e.ip()),
                CeldaCsv.de(e.userAgent()),
                CeldaCsv.de(e.idCorrelacion()),
                CeldaCsv.de(e.detalle() == null ? null : e.detalle().toString())));
        w.write("\r\n");
    }

    private static List<String> nombres(Enum<?>[] valores) {
        return Arrays.stream(valores).map(Enum::name).toList();
    }
}
