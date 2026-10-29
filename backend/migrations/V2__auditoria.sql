-- Active: 1791152181635@@127.0.0.1@3306@hehiachi_mishima
-- ============================================================
-- V2 — Bitácora de auditoría + permiso VER_AUDITORIA + índices
--      + columnas de seguridad en usuarios (revocación de JWT y
--        bloqueo por fuerza bruta)
-- ============================================================
-- Para BDs creadas con una versión anterior de schema.sql.
-- IDEMPOTENTE: se puede ejecutar N veces sin error ni duplicados.
-- Compatible con MySQL 8.0.29+ / 8.4 (Aiven). No usa procedimientos
-- almacenados (solo sentencias preparadas), así que no requiere el
-- privilegio CREATE ROUTINE.
--
-- Uso (con la BD seleccionada; NO se fuerza `USE` para que sirva
-- tanto en local como en Aiven, donde el nombre puede diferir):
--   mysql -h <host> -P <puerto> -u <usuario> -p <bd> < migrations/V2__auditoria.sql
--
-- Los ALTER de índices usan ALGORITHM=INPLACE, LOCK=NONE: no
-- bloquean lecturas ni escrituras de la tabla mientras se construyen.
-- ============================================================

SET NAMES utf8mb4;

-- ------------------------------------------------------------
-- 1) Tabla auditoria_eventos (mismo DDL que schema.sql §7)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria_eventos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador del evento.',
    ocurrido_en TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT 'Instante del evento (UTC).',
    actor_id BIGINT NULL COMMENT 'Usuario que actúa. NULL = anónimo (login fallido), 0 = sistema.',
    actor_usuario VARCHAR(100) NULL COMMENT 'Snapshot del login del actor (o credencial intentada en LOGIN_FALLIDO).',
    accion VARCHAR(40) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'Código de acción (catálogo en la app).',
    entidad VARCHAR(30) CHARACTER SET ascii COLLATE ascii_general_ci NULL COMMENT 'USUARIO, ROL, PERMISO, USUARIO_ROL, ROL_PERMISO, USUARIO_PERMISO, SESION.',
    entidad_id VARCHAR(64) NULL COMMENT 'Id afectado; compuesto como "usuarioId:rolId".',
    resultado VARCHAR(10) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'EXITO, FALLO, DENEGADO.',
    ip VARCHAR(45) NULL COMMENT 'IP del cliente (IPv4/IPv6).',
    user_agent VARCHAR(255) NULL COMMENT 'User-Agent truncado a 255.',
    id_correlacion VARCHAR(64) NULL COMMENT 'X-Request-Id de la petición.',
    detalle JSON NULL COMMENT '{antes,despues} o {motivo}. NUNCA contraseñas, hashes ni tokens.',
    CONSTRAINT ck_auditoria_eventos_resultado CHECK (resultado IN ('EXITO', 'FALLO', 'DENEGADO')),
    INDEX idx_auditoria_ocurrido (ocurrido_en) COMMENT 'Listado general por rango de fechas, orden DESC.',
    INDEX idx_auditoria_actor (actor_id, ocurrido_en) COMMENT 'Actividad de un actor.',
    INDEX idx_auditoria_entidad (entidad, entidad_id, ocurrido_en) COMMENT 'Historia de una entidad concreta.',
    INDEX idx_auditoria_accion (accion, ocurrido_en) COMMENT 'Filtro por tipo de acción.',
    INDEX idx_auditoria_resultado (resultado, ocurrido_en) COMMENT 'Filtro por resultado (FALLO/DENEGADO).'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Bitácora de auditoría append-only (UPDATE/DELETE bloqueados por trigger).';

-- ------------------------------------------------------------
-- 2) Índices: "crear si no existe" / "eliminar si existe".
--    MySQL 8 no tiene CREATE INDEX IF NOT EXISTS: se consulta
--    information_schema y se ejecuta el DDL o un no-op (DO 0).
--    Cubre el caso de una auditoria_eventos creada a mano antes de V2.
-- ------------------------------------------------------------

-- auditoria_eventos (contrato)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics
               WHERE table_schema = DATABASE() AND table_name = 'auditoria_eventos'
                 AND index_name = 'idx_auditoria_ocurrido') = 0,
    'ALTER TABLE auditoria_eventos ADD INDEX idx_auditoria_ocurrido (ocurrido_en), ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics
               WHERE table_schema = DATABASE() AND table_name = 'auditoria_eventos'
                 AND index_name = 'idx_auditoria_actor') = 0,
    'ALTER TABLE auditoria_eventos ADD INDEX idx_auditoria_actor (actor_id, ocurrido_en), ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics
               WHERE table_schema = DATABASE() AND table_name = 'auditoria_eventos'
                 AND index_name = 'idx_auditoria_entidad') = 0,
    'ALTER TABLE auditoria_eventos ADD INDEX idx_auditoria_entidad (entidad, entidad_id, ocurrido_en), ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics
               WHERE table_schema = DATABASE() AND table_name = 'auditoria_eventos'
                 AND index_name = 'idx_auditoria_accion') = 0,
    'ALTER TABLE auditoria_eventos ADD INDEX idx_auditoria_accion (accion, ocurrido_en), ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics
               WHERE table_schema = DATABASE() AND table_name = 'auditoria_eventos'
                 AND index_name = 'idx_auditoria_resultado') = 0,
    'ALTER TABLE auditoria_eventos ADD INDEX idx_auditoria_resultado (resultado, ocurrido_en), ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- usuarios: idx_usuarios_creado_en (creado_en) -> idx_usuarios_creado_activo (creado_en, activo).
-- AnaliticaAdminRepository.altasPorMes filtra por rango de creado_en y suma
-- activo: con el índice compuesto la consulta es "Using index" (no lee filas).
-- Primero se crea el nuevo y después se elimina el viejo (nunca hay hueco).
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics
               WHERE table_schema = DATABASE() AND table_name = 'usuarios'
                 AND index_name = 'idx_usuarios_creado_activo') = 0,
    'ALTER TABLE usuarios ADD INDEX idx_usuarios_creado_activo (creado_en, activo) COMMENT ''Altas por mes (analítica): rango por creado_en y SUM(activo) cubiertos sin leer la fila.'', ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics
               WHERE table_schema = DATABASE() AND table_name = 'usuarios'
                 AND index_name = 'idx_usuarios_creado_en') > 0,
    'ALTER TABLE usuarios DROP INDEX idx_usuarios_creado_en, ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 3) usuarios: columnas de seguridad (ADD COLUMN si no existe)
--    ALGORITHM=INSTANT (8.0.29+): solo metadatos, sin reconstruir la
--    tabla ni bloquear escrituras, aunque haya millones de filas.
--    - credenciales_version: claim `ver` del JWT; +1 al cambiar
--      contraseña o desactivar → los tokens anteriores quedan revocados.
--    - intentos_fallidos / bloqueado_hasta: bloqueo por cuenta.
-- ------------------------------------------------------------
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns
               WHERE table_schema = DATABASE() AND table_name = 'usuarios'
                 AND column_name = 'credenciales_version') = 0,
    'ALTER TABLE usuarios ADD COLUMN credenciales_version INT NOT NULL DEFAULT 0 COMMENT ''Se incrementa al cambiar contraseña o desactivar. El JWT lleva el claim ver; si no coincide, el token queda revocado.'' AFTER activo, ALGORITHM=INSTANT',
    'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns
               WHERE table_schema = DATABASE() AND table_name = 'usuarios'
                 AND column_name = 'intentos_fallidos') = 0,
    'ALTER TABLE usuarios ADD COLUMN intentos_fallidos INT NOT NULL DEFAULT 0 COMMENT ''Logins fallidos consecutivos. Se pone a 0 tras un login correcto.'' AFTER credenciales_version, ALGORITHM=INSTANT',
    'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns
               WHERE table_schema = DATABASE() AND table_name = 'usuarios'
                 AND column_name = 'bloqueado_hasta') = 0,
    'ALTER TABLE usuarios ADD COLUMN bloqueado_hasta TIMESTAMP(6) NULL DEFAULT NULL COMMENT ''Bloqueo temporal por fuerza bruta (UTC). NULL = sin bloqueo.'' AFTER intentos_fallidos, ALGORITHM=INSTANT',
    'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = NULL;

-- ------------------------------------------------------------
-- 4) Se retiran los triggers que se van a redefinir ANTES de tocar
--    datos: así el upsert de VER_AUDITORIA (paso 5) no choca con
--    trg_permisos_base_update si el permiso ya existía.
--    (Ventana sin protección = lo que dura este script.)
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_auditoria_eventos_no_update;

DROP TRIGGER IF EXISTS trg_auditoria_eventos_no_delete;

DROP TRIGGER IF EXISTS trg_permisos_base_update;

DROP TRIGGER IF EXISTS trg_permisos_base_delete;

DROP TRIGGER IF EXISTS trg_usuarios_admin_update;

-- ------------------------------------------------------------
-- 5) Permiso base VER_AUDITORIA
--    a) Si no existe, se crea (trg_permisos_after_insert lo asigna
--       a ADMINISTRADOR).
--    b) Si ya existía (creado a mano antes de ser base), se normaliza
--       su descripción y se reactiva.
-- ------------------------------------------------------------
INSERT INTO permisos (nombre, descripcion, activo, creado_por, actualizado_por)
SELECT 'VER_AUDITORIA', 'Permite consultar y exportar la bitácora de auditoría.', TRUE, 0, 0
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM permisos WHERE nombre = 'VER_AUDITORIA');

UPDATE permisos
SET descripcion = 'Permite consultar y exportar la bitácora de auditoría.',
    activo = TRUE,
    actualizado_por = 0
WHERE nombre = 'VER_AUDITORIA'
  AND (NOT (descripcion <=> 'Permite consultar y exportar la bitácora de auditoría.') OR activo = FALSE);

-- ------------------------------------------------------------
-- 6) Asignación a ADMINISTRADOR (idempotente; cubre el caso b)
-- ------------------------------------------------------------
INSERT INTO roles_permisos (rol_id, permiso_id, creado_por)
SELECT r.id, p.id, 0
FROM roles r
JOIN permisos p ON p.nombre = 'VER_AUDITORIA'
WHERE r.nombre = 'ADMINISTRADOR'
  AND NOT EXISTS (
      SELECT 1 FROM roles_permisos rp WHERE rp.rol_id = r.id AND rp.permiso_id = p.id
  );

-- ------------------------------------------------------------
-- 7) Triggers
--    a) append-only de auditoria_eventos
--    b) permisos base, ahora con VER_AUDITORIA (misma lista que
--       schema.sql, protection.admin.sql y Protecciones.PERMISOS_BASE)
--    c) @hehiachi: igual que protection.admin.sql (permite solo los
--       contadores de bloqueo; usa las columnas del paso 3)
-- ------------------------------------------------------------
DELIMITER $$

CREATE TRIGGER trg_auditoria_eventos_no_update
BEFORE UPDATE ON auditoria_eventos
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'La bitácora de auditoría es append-only: no se puede modificar un evento.';
END$$

CREATE TRIGGER trg_auditoria_eventos_no_delete
BEFORE DELETE ON auditoria_eventos
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'La bitácora de auditoría es append-only: no se puede eliminar un evento.';
END$$

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

CREATE TRIGGER trg_usuarios_admin_update
BEFORE UPDATE ON usuarios
FOR EACH ROW
BEGIN
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

DELIMITER ;

-- ------------------------------------------------------------
-- 8) (Opcional, ejecutar como DBA, NO forma parte de la migración)
--    TRUNCATE y DROP no disparan triggers. Para que el append-only sea
--    real, el usuario de la aplicación solo debe tener INSERT y SELECT
--    sobre la bitácora. Ejemplo con un usuario dedicado:
--      REVOKE ALL PRIVILEGES ON <bd>.auditoria_eventos FROM 'app'@'%';
--      GRANT SELECT, INSERT ON <bd>.auditoria_eventos TO 'app'@'%';
--    (En MySQL los GRANT a nivel de tabla se suman a los de BD: si 'app'
--     tiene ALL sobre <bd>.*, hay que reemplazarlo por grants por tabla.)
-- ------------------------------------------------------------
