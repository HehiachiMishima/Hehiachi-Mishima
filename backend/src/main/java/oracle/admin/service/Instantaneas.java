package oracle.admin.service;

import java.util.Map;
import oracle.admin.model.Permiso;
import oracle.admin.model.Rol;
import oracle.admin.model.Usuario;
import oracle.auditoria.Detalle;

/** Instantaneas para el detalle de la bitacora. NUNCA incluyen contrasena ni hash. */
final class Instantaneas {

    static Map<String, Object> usuario(Usuario u) {
        return Detalle.de("id", u.getId(), "usuario", u.getUsuario(), "nombre", u.getNombre(),
                "apellido", u.getApellido(), "email", u.getEmail(), "telefono", u.getTelefono(),
                "activo", u.getActivo());
    }

    static Map<String, Object> rol(Rol r) {
        return Detalle.de("id", r.getId(), "nombre", r.getNombre(), "descripcion", r.getDescripcion(),
                "activo", r.getActivo());
    }

    static Map<String, Object> permiso(Permiso p) {
        return Detalle.de("id", p.getId(), "nombre", p.getNombre(), "descripcion", p.getDescripcion(),
                "activo", p.getActivo());
    }

    static Map<String, Object> activo(Boolean activo) {
        return Detalle.de("activo", activo);
    }

    private Instantaneas() {
    }
}
