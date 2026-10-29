package oracle.admin.response;

import java.time.LocalDateTime;
import oracle.admin.model.Usuario;

/**
 * Salida publica de usuario. protegido = true si la UI debe deshabilitar sus
 * acciones de administracion (usuario protegido o la propia cuenta del actor).
 */
public record UsuarioResponse(
        Long id,
        String usuario,
        String nombre,
        String apellido,
        String email,
        String telefono,
        Boolean activo,
        LocalDateTime creadoEn,
        LocalDateTime actualizadoEn,
        Long creadoPor,
        Long actualizadoPor,
        boolean protegido) {

    public static UsuarioResponse of(Usuario u, boolean protegido) {
        return new UsuarioResponse(
                u.getId(), u.getUsuario(), u.getNombre(), u.getApellido(), u.getEmail(),
                u.getTelefono(), u.getActivo(), u.getCreadoEn(), u.getActualizadoEn(),
                u.getCreadoPor(), u.getActualizadoPor(), protegido);
    }
}
