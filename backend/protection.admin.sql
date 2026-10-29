-- ------------------------------------------------------------
-- USUARIO '@hehiachi' (protección TOTAL por NOMBRE)
--   - No se puede eliminar.
--   - No se puede modificar NINGÚN campo de identidad, credencial
--     ni estado. ÚNICA excepción: los contadores operativos de
--     bloqueo por fuerza bruta (intentos_fallidos, bloqueado_hasta)
--     y su sello (actualizado_por/actualizado_en); si no, un login
--     fallido de @hehiachi rompería el flujo de autenticación.
--   - usuarios_roles: no se puede agregar ni quitar.
--
-- Idempotente: se puede re-ejecutar (DROP TRIGGER IF EXISTS + CREATE).
-- Ejecutar DESPUÉS de schema.sql, con la BD seleccionada
-- (mysql ... <bd> < protection.admin.sql).
-- También (re)crea los triggers de PERMISOS BASE con la lista
-- vigente (incluye VER_AUDITORIA), idénticos a los de schema.sql.
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_usuarios_admin_update;

DROP TRIGGER IF EXISTS trg_usuarios_admin_delete;

DROP TRIGGER IF EXISTS trg_usuarios_roles_admin_insert;

DROP TRIGGER IF EXISTS trg_usuarios_roles_admin_delete;

DROP TRIGGER IF EXISTS trg_usuarios_permisos_admin_insert;

DROP TRIGGER IF EXISTS trg_usuarios_permisos_admin_update;

DROP TRIGGER IF EXISTS trg_usuarios_permisos_admin_delete;

DROP TRIGGER IF EXISTS trg_permisos_base_update;

DROP TRIGGER IF EXISTS trg_permisos_base_delete;

DELIMITER $$

CREATE TRIGGER trg_usuarios_admin_update
BEFORE UPDATE ON usuarios
FOR EACH ROW
BEGIN
    -- <=> es la igualdad NULL-safe (telefono puede ser NULL).
    IF OLD.usuario = '@hehiachi' AND NOT (
            NEW.usuario <=> OLD.usuario
        AND NEW.contrasena <=> OLD.contrasena
        AND NEW.nombre <=> OLD.nombre
        AND NEW.apellido <=> OLD.apellido
        AND NEW.email <=> OLD.email
        AND NEW.telefono <=> OLD.telefono
        AND NEW.activo <=> OLD.activo
        AND NEW.credenciales_version <=> OLD.credenciales_version
        AND NEW.creado_por <=> OLD.creado_por
        AND NEW.creado_en <=> OLD.creado_en
        AND NEW.id <=> OLD.id
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede modificar al usuario @hehiachi.';
    END IF;
END$$

CREATE TRIGGER trg_usuarios_admin_delete
BEFORE DELETE ON usuarios
FOR EACH ROW
BEGIN
    IF OLD.usuario = '@hehiachi' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede eliminar al usuario @hehiachi.';
    END IF;
END$$

CREATE TRIGGER trg_usuarios_roles_admin_insert
BEFORE INSERT ON usuarios_roles
FOR EACH ROW
BEGIN
    DECLARE v_usuario VARCHAR(50);
    DECLARE v_roles INT;
    SELECT usuario INTO v_usuario FROM usuarios WHERE id = NEW.usuario_id;
    IF v_usuario = '@hehiachi' THEN
        SELECT COUNT(*) INTO v_roles FROM usuarios_roles WHERE usuario_id = NEW.usuario_id;
        IF v_roles > 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'No se puede modificar el rol de @hehiachi.';
        END IF;
    END IF;
END$$

CREATE TRIGGER trg_usuarios_roles_admin_delete
BEFORE DELETE ON usuarios_roles
FOR EACH ROW
BEGIN
    DECLARE v_usuario VARCHAR(50);
    SELECT usuario INTO v_usuario FROM usuarios WHERE id = OLD.usuario_id;
    IF v_usuario = '@hehiachi' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede modificar el rol de @hehiachi.';
    END IF;
END$$

-- Bloquea INSERT de overrides para @hehiachi
CREATE TRIGGER trg_usuarios_permisos_admin_insert
BEFORE INSERT ON usuarios_permisos
FOR EACH ROW
BEGIN
    DECLARE v_usuario VARCHAR(50);
    SELECT usuario INTO v_usuario FROM usuarios WHERE id = NEW.usuario_id;
    IF v_usuario = '@hehiachi' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se pueden otorgar ni denegar permisos al usuario @hehiachi.';
    END IF;
END$$

-- Bloquea UPDATE sobre overrides de @hehiachi y también
-- impide "mover" un override hacia @hehiachi cambiando usuario_id
CREATE TRIGGER trg_usuarios_permisos_admin_update
BEFORE UPDATE ON usuarios_permisos
FOR EACH ROW
BEGIN
    DECLARE v_old_usuario VARCHAR(50);
    DECLARE v_new_usuario VARCHAR(50);
    SELECT usuario INTO v_old_usuario FROM usuarios WHERE id = OLD.usuario_id;
    SELECT usuario INTO v_new_usuario FROM usuarios WHERE id = NEW.usuario_id;
    IF v_old_usuario = '@hehiachi' OR v_new_usuario = '@hehiachi' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se pueden modificar los permisos del usuario @hehiachi.';
    END IF;
END$$

-- Bloquea DELETE de overrides de @hehiachi
CREATE TRIGGER trg_usuarios_permisos_admin_delete
BEFORE DELETE ON usuarios_permisos
FOR EACH ROW
BEGIN
    DECLARE v_usuario VARCHAR(50);
    SELECT usuario INTO v_usuario FROM usuarios WHERE id = OLD.usuario_id;
    IF v_usuario = '@hehiachi' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se pueden eliminar los permisos del usuario @hehiachi.';
    END IF;
END$$

-- ------------------------------------------------------------
-- PERMISOS BASE (por NOMBRE) — idénticos a schema.sql.
-- La lista se repite en: schema.sql, migrations/V2__auditoria.sql
-- y oracle.admin.service.Protecciones.PERMISOS_BASE. Mantenerlas iguales.
-- ------------------------------------------------------------
CREATE TRIGGER trg_permisos_base_update
BEFORE UPDATE ON permisos
FOR EACH ROW
BEGIN
    IF OLD.nombre IN (
        'ASIGNAR_ROLES', 'VER_ROLES', 'CREAR_ROLES', 'MODIFICAR_ROLES', 'ELIMINAR_ROLES',
        'ASIGNAR_PERMISOS', 'VER_PERMISOS', 'CREAR_PERMISOS', 'MODIFICAR_PERMISOS', 'ELIMINAR_PERMISOS',
        'VER_USUARIOS', 'CREAR_USUARIOS', 'MODIFICAR_USUARIOS', 'ELIMINAR_USUARIOS',
        'PANEL_ADMIN', 'DASHBOARD_ADMIN', 'VER_AUDITORIA'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede modificar un permiso base. Ni siquiera se puede desactivar.';
    END IF;
END$$

CREATE TRIGGER trg_permisos_base_delete
BEFORE DELETE ON permisos
FOR EACH ROW
BEGIN
    IF OLD.nombre IN (
        'ASIGNAR_ROLES', 'VER_ROLES', 'CREAR_ROLES', 'MODIFICAR_ROLES', 'ELIMINAR_ROLES',
        'ASIGNAR_PERMISOS', 'VER_PERMISOS', 'CREAR_PERMISOS', 'MODIFICAR_PERMISOS', 'ELIMINAR_PERMISOS',
        'VER_USUARIOS', 'CREAR_USUARIOS', 'MODIFICAR_USUARIOS', 'ELIMINAR_USUARIOS',
        'PANEL_ADMIN', 'DASHBOARD_ADMIN', 'VER_AUDITORIA'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede eliminar un permiso base. Es inmutable e intocable.';
    END IF;
END$$

DELIMITER ;
