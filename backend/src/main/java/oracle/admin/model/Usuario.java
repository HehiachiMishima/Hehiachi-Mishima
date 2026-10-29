package oracle.admin.model;

import oracle.common.model.Auditable;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "usuarios")
@Getter
@Setter
public class Usuario extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "usuario", nullable = false, unique = true, length = 50)
    private String usuario;

    @Column(name = "contrasena", nullable = false, length = 100)
    private String contrasena;

    @Column(name = "nombre", nullable = false, length = 100)
    private String nombre;

    @Column(name = "apellido", nullable = false, length = 100)
    private String apellido;

    @Column(name = "email", nullable = false, unique = true, length = 100)
    private String email;

    @Column(name = "telefono", length = 20)
    private String telefono;

    @Column(name = "activo", nullable = false)
    private Boolean activo = Boolean.TRUE;

    /**
     * Version de credenciales (claim "ver" del JWT). Se incrementa al cambiar la
     * contrasena, el nombre de usuario o al desactivar la cuenta: revoca los
     * tokens emitidos antes. Los contadores de bloqueo (intentos_fallidos,
     * bloqueado_hasta) NO se mapean: se actualizan con UPDATE atomicos en
     * UsuarioRepository para no pisar escrituras concurrentes con save().
     */
    @Column(name = "credenciales_version", nullable = false)
    private Integer credencialesVersion = 0;

    /** Incrementa la version de credenciales (revoca los JWT vigentes). */
    public void revocarCredenciales() {
        credencialesVersion = (credencialesVersion == null ? 0 : credencialesVersion) + 1;
    }
}
