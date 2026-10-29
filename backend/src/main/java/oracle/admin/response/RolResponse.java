package oracle.admin.response;

import java.time.LocalDateTime;
import oracle.admin.service.Protecciones;
import oracle.admin.model.Rol;

/** Salida publica de rol. protegido = ADMINISTRADOR (no se modifica ni elimina). */
public record RolResponse(
        Long id,
        String nombre,
        String descripcion,
        Boolean activo,
        LocalDateTime creadoEn,
        LocalDateTime actualizadoEn,
        Long creadoPor,
        Long actualizadoPor,
        boolean protegido) {

    public static RolResponse of(Rol r) {
        return new RolResponse(
                r.getId(), r.getNombre(), r.getDescripcion(), r.getActivo(), r.getCreadoEn(), r.getActualizadoEn(),
                r.getCreadoPor(), r.getActualizadoPor(), Protecciones.esRolAdministrador(r.getNombre()));
    }
}
