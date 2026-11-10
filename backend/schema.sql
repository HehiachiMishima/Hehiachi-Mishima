-- Active: 1793813862107@@localhost@5432@app_configuration

BEGIN;

SET LOCAL client_min_messages = warning;
SET LOCAL TIME ZONE 'UTC';
DROP SCHEMA IF EXISTS seguridad CASCADE;
DROP SCHEMA IF EXISTS comun CASCADE;

-- Búsquedas "contiene" (LIKE '%texto%') por índice trigram.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- ############################################################
-- 1. comun: piezas compartidas por todos los dominios
-- ############################################################
CREATE SCHEMA comun;
COMMENT ON SCHEMA comun IS 'Colación, funciones y triggers compartidos.';

-- Igualdad sin mayúsculas ni tildes (ICU, nivel 1). No determinista: sirve
-- para =, IN, UNIQUE, GROUP BY y ORDER BY, pero PostgreSQL no admite LIKE ni
-- ILIKE sobre ella. Por eso NO se pone en las columnas (el backend busca con
-- ILIKE): se usa en los índices únicos (usuario COLLATE comun.ci) y en las
-- funciones de protección, que la aplican de forma explícita.
CREATE COLLATION comun.ci (provider = icu, locale = 'und-u-ks-level1', deterministic = false);

-- Mantiene actualizado_en en cada UPDATE salvo que quien escribe ya lo haya
-- cambiado (Hibernate lo fija con @LastModifiedDate).
CREATE FUNCTION comun.fijar_actualizado_en()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.actualizado_en IS NOT DISTINCT FROM OLD.actualizado_en THEN
        NEW.actualizado_en := now();
    END IF;
    RETURN NEW;
END;
$$;

-- Error de protección: el backend responde 403 con este mensaje
-- (GlobalExceptionHandler.SQLSTATE_PROTECCION = 'RB403').
CREATE FUNCTION comun.proteger(mensaje text)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION USING ERRCODE = 'RB403', MESSAGE = mensaje;
END;
$$;

-- ############################################################
-- 2. seguridad: RBAC + overrides + sesiones
-- ############################################################
CREATE SCHEMA seguridad;
COMMENT ON SCHEMA seguridad IS 'Usuarios, roles, permisos, overrides, sesiones y resolución de permisos.';

-- Nombres protegidos: el backend replica estas listas en Protecciones.
CREATE FUNCTION seguridad.es_usuario_protegido(usuario text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
RETURN usuario COLLATE comun.ci IN ('@admin', '@hehiachi');

CREATE FUNCTION seguridad.es_rol_protegido(nombre text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
RETURN nombre COLLATE comun.ci = 'ADMINISTRADOR';

CREATE FUNCTION seguridad.es_permiso_base(nombre text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
RETURN nombre COLLATE comun.ci IN (
    'ASIGNAR_ROLES', 'VER_ROLES', 'CREAR_ROLES', 'MODIFICAR_ROLES', 'ELIMINAR_ROLES',
    'ASIGNAR_PERMISOS', 'VER_PERMISOS', 'CREAR_PERMISOS', 'MODIFICAR_PERMISOS', 'ELIMINAR_PERMISOS',
    'VER_USUARIOS', 'CREAR_USUARIOS', 'MODIFICAR_USUARIOS', 'ELIMINAR_USUARIOS',
    'PANEL_ADMIN', 'DASHBOARD_ADMIN', 'VER_AUDITORIA', 'VER_MONITOREO');

-- ------------------------------------------------------------
-- usuarios
-- ------------------------------------------------------------
CREATE TABLE seguridad.usuarios (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario         VARCHAR(50)  NOT NULL,
    contrasena      VARCHAR(100) NOT NULL,
    nombre          VARCHAR(100) NOT NULL,
    apellido        VARCHAR(100) NOT NULL,
    email           VARCHAR(100) NOT NULL,
    telefono        VARCHAR(20),
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    credenciales_desde TIMESTAMPTZ NOT NULL DEFAULT now(),
    credenciales_version INTEGER NOT NULL DEFAULT 0,
    intentos_fallidos INTEGER    NOT NULL DEFAULT 0,
    bloqueado_hasta TIMESTAMPTZ,
    creado_por      BIGINT,
    actualizado_por BIGINT       NOT NULL,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_usuarios_usuario CHECK (btrim(usuario) <> ''),
    CONSTRAINT ck_usuarios_version CHECK (credenciales_version >= 0),
    CONSTRAINT ck_usuarios_intentos CHECK (intentos_fallidos >= 0)
);
-- Únicos sin distinguir mayúsculas ni tildes (la collation va en el índice).
CREATE UNIQUE INDEX uq_usuarios_usuario ON seguridad.usuarios ((usuario COLLATE comun.ci));
CREATE UNIQUE INDEX uq_usuarios_email ON seguridad.usuarios ((email COLLATE comun.ci));
CREATE INDEX idx_usuarios_activo_nombre ON seguridad.usuarios (activo, apellido, nombre);
CREATE INDEX idx_usuarios_nombre ON seguridad.usuarios (apellido, nombre);
CREATE INDEX idx_usuarios_creado_en ON seguridad.usuarios (creado_en);
-- Búsqueda "contiene" (ILIKE '%x%') en los cuatro campos del filtro de usuarios.
CREATE INDEX idx_usuarios_busqueda_trgm ON seguridad.usuarios
    USING gin (usuario public.gin_trgm_ops, nombre public.gin_trgm_ops,
               apellido public.gin_trgm_ops, email public.gin_trgm_ops);
-- Solo las cuentas con bloqueo temporal (fracción mínima de la tabla).
CREATE INDEX idx_usuarios_bloqueados ON seguridad.usuarios (bloqueado_hasta) WHERE bloqueado_hasta IS NOT NULL;
COMMENT ON TABLE seguridad.usuarios IS 'Usuarios del sistema. @admin y @hehiachi están protegidos por nombre.';
COMMENT ON COLUMN seguridad.usuarios.usuario IS 'Login único, sin distinguir mayúsculas ni tildes (uq_usuarios_usuario).';
COMMENT ON COLUMN seguridad.usuarios.contrasena IS 'Hash bcrypt.';
COMMENT ON COLUMN seguridad.usuarios.activo IS 'TRUE = puede iniciar sesión; FALSE = bloqueado.';
COMMENT ON COLUMN seguridad.usuarios.credenciales_desde IS 'Último cambio de contraseña: los tokens emitidos antes dejan de valer (lo fija un trigger).';
COMMENT ON COLUMN seguridad.usuarios.credenciales_version IS 'Claim "ver" del JWT: el backend lo sube al cambiar contraseña o desactivar y revoca los tokens anteriores.';
COMMENT ON COLUMN seguridad.usuarios.intentos_fallidos IS 'Logins fallidos consecutivos; vuelve a 0 tras un login correcto.';
COMMENT ON COLUMN seguridad.usuarios.bloqueado_hasta IS 'Bloqueo temporal por fuerza bruta (1, 2, 4... min). NULL = sin bloqueo.';
COMMENT ON COLUMN seguridad.usuarios.creado_por IS 'Usuario que lo creó; NULL en el primero, 0 = sistema.';

-- ------------------------------------------------------------
-- roles
-- ------------------------------------------------------------
CREATE TABLE seguridad.roles (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre          VARCHAR(50)  NOT NULL,
    descripcion     VARCHAR(200),
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_por      BIGINT       NOT NULL,
    actualizado_por BIGINT       NOT NULL,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_roles_nombre CHECK (btrim(nombre) <> '')
);
CREATE UNIQUE INDEX uq_roles_nombre ON seguridad.roles ((nombre COLLATE comun.ci));
CREATE INDEX idx_roles_activo ON seguridad.roles (activo);
CREATE INDEX idx_roles_busqueda_trgm ON seguridad.roles USING gin (nombre public.gin_trgm_ops, descripcion public.gin_trgm_ops);
COMMENT ON TABLE seguridad.roles IS 'Roles. ADMINISTRADOR está protegido: solo se le agregan permisos.';

-- ------------------------------------------------------------
-- permisos
-- ------------------------------------------------------------
CREATE TABLE seguridad.permisos (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre          VARCHAR(50)  NOT NULL,
    descripcion     VARCHAR(200),
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_por      BIGINT       NOT NULL,
    actualizado_por BIGINT       NOT NULL,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_permisos_nombre CHECK (btrim(nombre) <> '')
);
CREATE UNIQUE INDEX uq_permisos_nombre ON seguridad.permisos ((nombre COLLATE comun.ci));
CREATE INDEX idx_permisos_activo ON seguridad.permisos (activo);
-- Cobertura de paneles del dashboard (nombre LIKE 'PANEL\_%' en permisos activos).
CREATE INDEX idx_permisos_paneles ON seguridad.permisos (nombre varchar_pattern_ops) WHERE activo;
CREATE INDEX idx_permisos_busqueda_trgm ON seguridad.permisos USING gin (nombre public.gin_trgm_ops, descripcion public.gin_trgm_ops);
COMMENT ON TABLE seguridad.permisos IS 'Catálogo de permisos. Los permisos base son inmutables.';

-- ------------------------------------------------------------
-- roles_permisos: plantilla RBAC
-- ------------------------------------------------------------
CREATE TABLE seguridad.roles_permisos (
    rol_id      BIGINT      NOT NULL REFERENCES seguridad.roles (id) ON DELETE CASCADE,
    permiso_id  BIGINT      NOT NULL REFERENCES seguridad.permisos (id) ON DELETE CASCADE,
    creado_por  BIGINT      NOT NULL,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (rol_id, permiso_id)
);
CREATE INDEX idx_roles_permisos_permiso ON seguridad.roles_permisos (permiso_id, rol_id);
COMMENT ON TABLE seguridad.roles_permisos IS 'Permisos que concede cada rol.';

-- ------------------------------------------------------------
-- usuarios_roles
-- ------------------------------------------------------------
CREATE TABLE seguridad.usuarios_roles (
    usuario_id  BIGINT      NOT NULL REFERENCES seguridad.usuarios (id) ON DELETE CASCADE,
    rol_id      BIGINT      NOT NULL REFERENCES seguridad.roles (id) ON DELETE CASCADE,
    creado_por  BIGINT      NOT NULL,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, rol_id)
);
CREATE INDEX idx_usuarios_roles_rol ON seguridad.usuarios_roles (rol_id, usuario_id);
COMMENT ON TABLE seguridad.usuarios_roles IS 'Roles asignados a cada usuario.';

-- ------------------------------------------------------------
-- usuarios_permisos: overrides individuales (deny-wins)
-- ------------------------------------------------------------
CREATE TABLE seguridad.usuarios_permisos (
    usuario_id      BIGINT      NOT NULL REFERENCES seguridad.usuarios (id) ON DELETE CASCADE,
    permiso_id      BIGINT      NOT NULL REFERENCES seguridad.permisos (id) ON DELETE CASCADE,
    otorgado        BOOLEAN     NOT NULL,
    creado_por      BIGINT      NOT NULL,
    actualizado_por BIGINT      NOT NULL,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, permiso_id)
);
CREATE INDEX idx_usuarios_permisos_permiso ON seguridad.usuarios_permisos (permiso_id, usuario_id);
COMMENT ON TABLE seguridad.usuarios_permisos IS 'Overrides por usuario: TRUE concede, FALSE deniega (la denegación gana).';

-- ------------------------------------------------------------
-- sesiones_refresh: renovación del access token sin contraseña
-- ------------------------------------------------------------
CREATE TABLE seguridad.sesiones_refresh (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id        BIGINT      NOT NULL REFERENCES seguridad.usuarios (id) ON DELETE CASCADE,
    familia           UUID        NOT NULL,
    token_hash        CHAR(64)    NOT NULL,
    expira_en         TIMESTAMPTZ NOT NULL,
    familia_expira_en TIMESTAMPTZ NOT NULL,
    revocado_en       TIMESTAMPTZ,
    ip                VARCHAR(45),
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_sesiones_refresh_token UNIQUE (token_hash),
    CONSTRAINT ck_sesiones_refresh_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_sesiones_refresh_expira CHECK (expira_en <= familia_expira_en)
);
CREATE INDEX idx_sesiones_refresh_familia ON seguridad.sesiones_refresh (familia) WHERE revocado_en IS NULL;
CREATE INDEX idx_sesiones_refresh_usuario ON seguridad.sesiones_refresh (usuario_id, familia_expira_en);
-- Purga programada de familias vencidas de todos los usuarios (SesionesRefresh.purgarVencidas).
CREATE INDEX idx_sesiones_refresh_vencidas ON seguridad.sesiones_refresh (familia_expira_en);
COMMENT ON TABLE seguridad.sesiones_refresh IS 'Refresh tokens (solo su SHA-256). Un login = una familia; cada renovación rota el token.';
COMMENT ON COLUMN seguridad.sesiones_refresh.expira_en IS 'Vence por inactividad; nunca después de familia_expira_en.';
COMMENT ON COLUMN seguridad.sesiones_refresh.familia_expira_en IS 'Máximo de la sesión desde el login.';

-- ------------------------------------------------------------
-- Vistas de resolución (respetan activo de rol y de permiso)
-- ------------------------------------------------------------
-- Una fila ROL por permiso (con los roles activos que lo conceden en un
-- array) y una fila OVERRIDE si existe.
CREATE VIEW seguridad.v_permisos_efectivos AS
SELECT ur.usuario_id, rp.permiso_id, TRUE AS otorgado, 'ROL'::text AS origen,
       array_agg(r.nombre::text ORDER BY r.nombre) AS roles
FROM seguridad.usuarios_roles ur
JOIN seguridad.roles r ON r.id = ur.rol_id AND r.activo
JOIN seguridad.roles_permisos rp ON rp.rol_id = ur.rol_id
JOIN seguridad.permisos p ON p.id = rp.permiso_id AND p.activo
GROUP BY ur.usuario_id, rp.permiso_id
UNION ALL
SELECT up.usuario_id, up.permiso_id, up.otorgado, 'OVERRIDE'::text AS origen, NULL::text[] AS roles
FROM seguridad.usuarios_permisos up
JOIN seguridad.permisos p ON p.id = up.permiso_id AND p.activo;
COMMENT ON VIEW seguridad.v_permisos_efectivos IS 'Cada concesión de un usuario: por rol (TRUE, con sus roles) o por override.';

CREATE VIEW seguridad.v_permisos_finales AS
SELECT usuario_id, permiso_id, bool_and(otorgado) AS permitido
FROM seguridad.v_permisos_efectivos
GROUP BY usuario_id, permiso_id;
COMMENT ON VIEW seguridad.v_permisos_finales IS 'Permiso final por usuario: basta una denegación para negarlo.';

-- Nombres de los permisos efectivos de un usuario (login, sesión y JWT).
CREATE FUNCTION seguridad.permisos_de(p_usuario_id bigint)
RETURNS TABLE (permiso_id bigint, nombre text)
LANGUAGE sql STABLE
SET search_path = ''
AS $$
    SELECT p.id, p.nombre
    FROM seguridad.v_permisos_finales f
    JOIN seguridad.permisos p ON p.id = f.permiso_id
    WHERE f.usuario_id = p_usuario_id AND f.permitido
    ORDER BY p.nombre
$$;

-- ------------------------------------------------------------
-- Triggers de seguridad
-- ------------------------------------------------------------

-- Todo permiso nuevo se concede al rol ADMINISTRADOR.
CREATE FUNCTION seguridad.conceder_a_administrador()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    INSERT INTO seguridad.roles_permisos (rol_id, permiso_id, creado_por)
    SELECT r.id, NEW.id, 0
    FROM seguridad.roles r
    WHERE seguridad.es_rol_protegido(r.nombre)
    ON CONFLICT DO NOTHING;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_permisos_conceder_admin
AFTER INSERT ON seguridad.permisos
FOR EACH ROW EXECUTE FUNCTION seguridad.conceder_a_administrador();

-- Rol ADMINISTRADOR: no se modifica ni se elimina.
CREATE FUNCTION seguridad.proteger_rol()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF seguridad.es_rol_protegido(OLD.nombre) THEN
        IF TG_OP = 'DELETE' THEN
            PERFORM comun.proteger('No se puede eliminar el rol ADMINISTRADOR.');
        END IF;
        PERFORM comun.proteger('No se puede modificar el rol ADMINISTRADOR. Solo se le pueden agregar permisos.');
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_roles_proteger
BEFORE UPDATE OR DELETE ON seguridad.roles
FOR EACH ROW EXECUTE FUNCTION seguridad.proteger_rol();

-- Al rol ADMINISTRADOR no se le quitan permisos (salvo que el permiso mismo
-- se esté eliminando: ese borrado llega aquí en cascada).
CREATE FUNCTION seguridad.proteger_permisos_administrador()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM seguridad.roles r
               WHERE r.id = OLD.rol_id AND seguridad.es_rol_protegido(r.nombre))
       AND EXISTS (SELECT 1 FROM seguridad.permisos p WHERE p.id = OLD.permiso_id) THEN
        PERFORM comun.proteger('No se pueden quitar permisos al rol ADMINISTRADOR. Solo se pueden agregar.');
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_roles_permisos_proteger
BEFORE DELETE ON seguridad.roles_permisos
FOR EACH ROW EXECUTE FUNCTION seguridad.proteger_permisos_administrador();

-- Permisos base: ni se modifican (tampoco se desactivan) ni se eliminan.
CREATE FUNCTION seguridad.proteger_permiso_base()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF seguridad.es_permiso_base(OLD.nombre) THEN
        IF TG_OP = 'DELETE' THEN
            PERFORM comun.proteger('No se puede eliminar un permiso base. Es inmutable e intocable.');
        END IF;
        PERFORM comun.proteger('No se puede modificar un permiso base. Ni siquiera se puede desactivar.');
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_permisos_proteger
BEFORE UPDATE OR DELETE ON seguridad.permisos
FOR EACH ROW EXECUTE FUNCTION seguridad.proteger_permiso_base();

-- Un cambio de contraseña invalida los tokens emitidos antes.
CREATE FUNCTION seguridad.renovar_credenciales()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.contrasena IS DISTINCT FROM OLD.contrasena THEN
        NEW.credenciales_desde := now();
    ELSE
        NEW.credenciales_desde := OLD.credenciales_desde;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_usuarios_credenciales
BEFORE UPDATE ON seguridad.usuarios
FOR EACH ROW EXECUTE FUNCTION seguridad.renovar_credenciales();

-- Usuarios protegidos: no se eliminan y solo puede cambiar su contraseña
-- (y con ella credenciales_desde/_version y el sello) y sus contadores de bloqueo
-- (si no, un login fallido suyo rompería la autenticación); nada más.
CREATE FUNCTION seguridad.proteger_usuario()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    -- Lo único que puede cambiar: contraseña, contadores de bloqueo y su sello.
    -- credenciales_version solo puede subir junto con un cambio de contraseña.
    v_libres text[] := ARRAY['contrasena', 'credenciales_desde',
                             'intentos_fallidos', 'bloqueado_hasta', 'actualizado_por', 'actualizado_en'];
BEGIN
    IF seguridad.es_usuario_protegido(OLD.usuario) THEN
        IF TG_OP = 'DELETE' THEN
            PERFORM comun.proteger(format('No se puede eliminar al usuario %s.', OLD.usuario));
        END IF;
        IF NEW.contrasena IS DISTINCT FROM OLD.contrasena THEN
            v_libres := v_libres || 'credenciales_version';
        END IF;
        IF (to_jsonb(NEW) - v_libres) IS DISTINCT FROM (to_jsonb(OLD) - v_libres) THEN
            PERFORM comun.proteger(format('No se puede modificar al usuario %s.', OLD.usuario));
        END IF;
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_usuarios_proteger
BEFORE UPDATE OR DELETE ON seguridad.usuarios
FOR EACH ROW EXECUTE FUNCTION seguridad.proteger_usuario();

-- Usuarios protegidos: reciben su primer rol (alta del usuario semilla) y
-- después sus roles no cambian. Un rol que se elimina llega en cascada.
CREATE FUNCTION seguridad.proteger_roles_usuario()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_usuario text;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT u.usuario INTO v_usuario FROM seguridad.usuarios u WHERE u.id = NEW.usuario_id;
        IF seguridad.es_usuario_protegido(v_usuario)
           AND EXISTS (SELECT 1 FROM seguridad.usuarios_roles ur WHERE ur.usuario_id = NEW.usuario_id) THEN
            PERFORM comun.proteger(format('No se puede modificar el rol de %s.', v_usuario));
        END IF;
        RETURN NEW;
    END IF;

    SELECT u.usuario INTO v_usuario FROM seguridad.usuarios u WHERE u.id = OLD.usuario_id;
    IF seguridad.es_usuario_protegido(v_usuario)
       AND EXISTS (SELECT 1 FROM seguridad.roles r WHERE r.id = OLD.rol_id) THEN
        PERFORM comun.proteger(format('No se puede modificar el rol de %s.', v_usuario));
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_usuarios_roles_proteger
BEFORE INSERT OR UPDATE OR DELETE ON seguridad.usuarios_roles
FOR EACH ROW EXECUTE FUNCTION seguridad.proteger_roles_usuario();

-- Usuarios protegidos: sin overrides (ni crear, ni cambiar, ni moverlos
-- hacia ellos, ni quitarlos). Un permiso que se elimina llega en cascada.
CREATE FUNCTION seguridad.proteger_overrides_usuario()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_usuario text;
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        SELECT u.usuario INTO v_usuario FROM seguridad.usuarios u WHERE u.id = NEW.usuario_id;
        IF seguridad.es_usuario_protegido(v_usuario) THEN
            PERFORM comun.proteger(format('No se pueden otorgar ni denegar permisos al usuario %s.', v_usuario));
        END IF;
    END IF;
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        SELECT u.usuario INTO v_usuario FROM seguridad.usuarios u WHERE u.id = OLD.usuario_id;
        IF seguridad.es_usuario_protegido(v_usuario)
           AND EXISTS (SELECT 1 FROM seguridad.permisos p WHERE p.id = OLD.permiso_id) THEN
            PERFORM comun.proteger(format('No se pueden modificar los permisos del usuario %s.', v_usuario));
        END IF;
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_usuarios_permisos_proteger
BEFORE INSERT OR UPDATE OR DELETE ON seguridad.usuarios_permisos
FOR EACH ROW EXECUTE FUNCTION seguridad.proteger_overrides_usuario();

-- actualizado_en al día en cada UPDATE (la función de comun ya existía,
-- faltaba engancharla a las tablas que tienen esa columna).
CREATE TRIGGER trg_usuarios_actualizado_en
BEFORE UPDATE ON seguridad.usuarios
FOR EACH ROW EXECUTE FUNCTION comun.fijar_actualizado_en();

CREATE TRIGGER trg_roles_actualizado_en
BEFORE UPDATE ON seguridad.roles
FOR EACH ROW EXECUTE FUNCTION comun.fijar_actualizado_en();

CREATE TRIGGER trg_permisos_actualizado_en
BEFORE UPDATE ON seguridad.permisos
FOR EACH ROW EXECUTE FUNCTION comun.fijar_actualizado_en();

CREATE TRIGGER trg_usuarios_permisos_actualizado_en
BEFORE UPDATE ON seguridad.usuarios_permisos
FOR EACH ROW EXECUTE FUNCTION comun.fijar_actualizado_en();

-- ############################################################
-- 3. bitacora: auditoría append-only
-- ############################################################
CREATE SCHEMA IF NOT EXISTS bitacora;
COMMENT ON SCHEMA bitacora IS 'Bitácora de auditoría: solo INSERT y SELECT.';
-- Idempotente: este script NO borra la bitácora al re-ejecutarse (los
-- eventos se conservan); solo crea lo que falte y refresca funciones y triggers.

-- Resultado del evento (el backend escribe y filtra con ?::resultado_auditoria).
DO $$
BEGIN
    IF to_regtype('bitacora.resultado_auditoria') IS NULL THEN
        CREATE TYPE bitacora.resultado_auditoria AS ENUM ('EXITO', 'FALLO', 'DENEGADO');
    END IF;
END;
$$;

-- Texto a inet sin fallar: la IP viene de cabeceras del cliente y un valor
-- inválido nunca debe romper el INSERT (se guarda NULL).
CREATE OR REPLACE FUNCTION bitacora.a_inet(p_valor text)
RETURNS inet
LANGUAGE plpgsql IMMUTABLE
SET search_path = ''
AS $$
BEGIN
    RETURN p_valor::inet;
EXCEPTION WHEN others THEN
    RETURN NULL;
END;
$$;

CREATE TABLE IF NOT EXISTS bitacora.auditoria_eventos (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ocurrido_en     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actor_id        BIGINT,
    actor_usuario   VARCHAR(100),
    accion          VARCHAR(40)  NOT NULL,
    entidad         VARCHAR(30),
    entidad_id      VARCHAR(64),
    resultado       bitacora.resultado_auditoria NOT NULL,
    ip              INET,
    user_agent      VARCHAR(255),
    id_correlacion  VARCHAR(64),
    detalle         JSONB,
    CONSTRAINT ck_auditoria_accion CHECK (accion ~ '^[A-Z_]+$'),
    CONSTRAINT ck_auditoria_entidad CHECK (entidad ~ '^[A-Z_]+$'),
    CONSTRAINT ck_auditoria_detalle CHECK (detalle IS NULL OR jsonb_typeof(detalle) = 'object')
);
-- Bitácoras creadas con la versión anterior de este script (resultado e ip
-- como VARCHAR): se convierten conservando los eventos.
DO $$
BEGIN
    IF (SELECT atttypid FROM pg_attribute
        WHERE attrelid = 'bitacora.auditoria_eventos'::regclass AND attname = 'resultado')
       <> 'bitacora.resultado_auditoria'::regtype THEN
        DROP INDEX IF EXISTS bitacora.idx_auditoria_incidencias;
        ALTER TABLE bitacora.auditoria_eventos DROP CONSTRAINT IF EXISTS ck_auditoria_resultado;
        ALTER TABLE bitacora.auditoria_eventos
            ALTER COLUMN resultado TYPE bitacora.resultado_auditoria
            USING resultado::text::bitacora.resultado_auditoria;
    END IF;
    IF (SELECT atttypid FROM pg_attribute
        WHERE attrelid = 'bitacora.auditoria_eventos'::regclass AND attname = 'ip')
       <> 'inet'::regtype THEN
        ALTER TABLE bitacora.auditoria_eventos
            ALTER COLUMN ip TYPE inet USING bitacora.a_inet(ip);
    END IF;
END;
$$;

-- Orden canónico de lectura: ocurrido_en DESC, id DESC (sin Sort).
CREATE INDEX IF NOT EXISTS idx_auditoria_ocurrido ON bitacora.auditoria_eventos (ocurrido_en DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_actor ON bitacora.auditoria_eventos (actor_id, ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON bitacora.auditoria_eventos (entidad, entidad_id, ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_accion ON bitacora.auditoria_eventos (accion, ocurrido_en DESC);
-- FALLO y DENEGADO son minoría: índice parcial pequeño.
CREATE INDEX IF NOT EXISTS idx_auditoria_incidencias ON bitacora.auditoria_eventos (resultado, ocurrido_en DESC)
    WHERE resultado <> 'EXITO';
CREATE INDEX IF NOT EXISTS idx_auditoria_correlacion ON bitacora.auditoria_eventos (id_correlacion)
    WHERE id_correlacion IS NOT NULL;
-- Búsquedas dentro del detalle: detalle @> '{"motivo": "cuenta_bloqueada"}'.
CREATE INDEX IF NOT EXISTS idx_auditoria_detalle ON bitacora.auditoria_eventos USING gin (detalle jsonb_path_ops);
COMMENT ON TABLE bitacora.auditoria_eventos IS 'Eventos de auditoría. Append-only: UPDATE, DELETE y TRUNCATE bloqueados.';
COMMENT ON COLUMN bitacora.auditoria_eventos.actor_id IS 'Usuario que actúa. NULL = anónimo (login fallido), 0 = sistema.';
COMMENT ON COLUMN bitacora.auditoria_eventos.actor_usuario IS 'Login del actor en ese momento (o la credencial intentada).';
COMMENT ON COLUMN bitacora.auditoria_eventos.entidad_id IS 'Id afectado; las relaciones usan "usuarioId:rolId".';
COMMENT ON COLUMN bitacora.auditoria_eventos.detalle IS '{antes, despues} o {motivo}. Nunca contraseñas, hashes ni tokens.';

-- Append-only. A diferencia de MySQL, PostgreSQL también dispara triggers
-- en TRUNCATE (a nivel de sentencia), así que se bloquea también.
CREATE OR REPLACE FUNCTION bitacora.solo_insercion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        PERFORM comun.proteger('La bitácora de auditoría es append-only: no se puede modificar un evento.');
    END IF;
    PERFORM comun.proteger('La bitácora de auditoría es append-only: no se pueden eliminar eventos.');
    RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER trg_auditoria_solo_insercion
BEFORE UPDATE OR DELETE ON bitacora.auditoria_eventos
FOR EACH ROW EXECUTE FUNCTION bitacora.solo_insercion();

CREATE OR REPLACE TRIGGER trg_auditoria_sin_truncate
BEFORE TRUNCATE ON bitacora.auditoria_eventos
FOR EACH STATEMENT EXECUTE FUNCTION bitacora.solo_insercion();

-- ------------------------------------------------------------
-- peticiones: traza HTTP de la API (quién llamó qué, estado y duración)
-- ------------------------------------------------------------
-- A diferencia de auditoria_eventos, admite DELETE para la purga por
-- retención (TrazaPeticiones.purgar, app.monitoreo.retencion-dias). Nunca
-- guarda query string, cuerpo ni cabeceras de autorización.
CREATE TABLE IF NOT EXISTS bitacora.peticiones (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ocurrido_en     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actor_id        BIGINT,
    actor_usuario   VARCHAR(100),
    metodo          VARCHAR(10)  NOT NULL,
    ruta            VARCHAR(200) NOT NULL,
    uri             VARCHAR(500) NOT NULL,
    estado          SMALLINT     NOT NULL,
    duracion_ms     INTEGER      NOT NULL,
    ip              inet,
    user_agent      VARCHAR(255),
    id_correlacion  VARCHAR(64),
    CONSTRAINT ck_peticiones_estado CHECK (estado BETWEEN 100 AND 599),
    CONSTRAINT ck_peticiones_duracion CHECK (duracion_ms >= 0)
);
CREATE INDEX IF NOT EXISTS idx_peticiones_ocurrido ON bitacora.peticiones (ocurrido_en DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_peticiones_actor ON bitacora.peticiones (actor_id, ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS idx_peticiones_ruta ON bitacora.peticiones (ruta, ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS idx_peticiones_errores ON bitacora.peticiones (estado, ocurrido_en DESC) WHERE estado >= 400;
CREATE INDEX IF NOT EXISTS idx_peticiones_lentas ON bitacora.peticiones (duracion_ms DESC, ocurrido_en DESC) WHERE duracion_ms >= 1000;
CREATE INDEX IF NOT EXISTS idx_peticiones_correlacion ON bitacora.peticiones (id_correlacion) WHERE id_correlacion IS NOT NULL;
COMMENT ON TABLE bitacora.peticiones IS 'Traza de peticiones HTTP de la API. Se purga por retención.';
COMMENT ON COLUMN bitacora.peticiones.ruta IS 'Plantilla de la ruta (p. ej. /api/usuarios/{id}); "(sin coincidencia)" si no hubo handler.';
COMMENT ON COLUMN bitacora.peticiones.uri IS 'Ruta real sin query string.';

-- Restos de versiones anteriores de este script.
DROP FUNCTION IF EXISTS bitacora.asegurar_particiones_bitacora(integer);

-- ############################################################
-- 4. Datos iniciales
-- ############################################################
-- Rol núcleo primero: el trigger de permisos lo necesita para concederle
-- cada permiso que se inserte después.
INSERT INTO seguridad.roles (nombre, descripcion, activo, creado_por, actualizado_por)
VALUES ('ADMINISTRADOR',
        'Rol núcleo con acceso total al sistema. No editable ni eliminable, solo se le pueden agregar permisos.',
        TRUE, 0, 0);

-- Permisos base (los mismos que seguridad.es_permiso_base).
INSERT INTO seguridad.permisos (nombre, descripcion, activo, creado_por, actualizado_por)
SELECT v.nombre, v.descripcion, TRUE, 0, 0
FROM (VALUES
    ('ASIGNAR_ROLES',      'Permite asignar roles a los usuarios.'),
    ('VER_ROLES',          'Permite listar y consultar roles.'),
    ('CREAR_ROLES',        'Permite crear nuevos roles.'),
    ('MODIFICAR_ROLES',    'Permite editar roles no protegidos.'),
    ('ELIMINAR_ROLES',     'Permite eliminar roles no protegidos.'),
    ('ASIGNAR_PERMISOS',   'Permite asignar permisos a un rol.'),
    ('VER_PERMISOS',       'Permite listar y consultar permisos.'),
    ('CREAR_PERMISOS',     'Permite crear nuevos permisos.'),
    ('MODIFICAR_PERMISOS', 'Permite editar permisos no base.'),
    ('ELIMINAR_PERMISOS',  'Permite eliminar permisos no base.'),
    ('VER_USUARIOS',       'Permite listar y consultar usuarios.'),
    ('CREAR_USUARIOS',     'Permite crear nuevos usuarios.'),
    ('MODIFICAR_USUARIOS', 'Permite editar usuarios existentes.'),
    ('ELIMINAR_USUARIOS',  'Permite eliminar usuarios no protegidos.'),
    ('PANEL_ADMIN',        'Permite el ingreso al panel administrador.'),
    ('DASHBOARD_ADMIN',    'Permite ver el dashboard de administradores.'),
    ('VER_AUDITORIA',      'Permite consultar y exportar la bitácora de auditoría.'),
    ('VER_MONITOREO',      'Permite ver el monitoreo del sistema y la traza de peticiones por usuario.')
) AS v (nombre, descripcion);
COMMIT;

