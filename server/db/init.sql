-- =============================================
-- Base de datos: contratos_db
-- Esquema de tablas para Gestión de Contratos
-- =============================================

-- Tabla de sesiones para connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
  "sid" VARCHAR NOT NULL COLLATE "default",
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- =============================================
-- Usuarios (Administradores)
-- =============================================
CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 VARCHAR(255) UNIQUE NOT NULL,
  contrasena_hash       TEXT NOT NULL,
  plan_actual           VARCHAR(20) DEFAULT 'Gratuito',
  contratos_usados_mes  INT DEFAULT 0,
  plantillas_creadas    INT DEFAULT 0,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agregar columnas de suscripción (idempotente)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS plan_estado VARCHAR(20) DEFAULT 'activo';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS suscripcion_mp_id VARCHAR(255);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS plan_vencimiento TIMESTAMP;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS mes_actual VARCHAR(7);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nombre VARCHAR(255);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nombre_empresa VARCHAR(255);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Columnas para backoffice de administración
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(20) DEFAULT 'user';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS trial_hasta TIMESTAMP;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS notas_admin TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS baja_motivo VARCHAR(255);

-- Columnas adicionales para contratos (Tarea 2: teléfono como identificador)
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_numero VARCHAR(30);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_nombre VARCHAR(255);

-- Actualizar constraint de plan_actual para incluir 'Empresa'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'usuarios_plan_actual_check' AND table_name = 'usuarios'
  ) THEN
    ALTER TABLE usuarios DROP CONSTRAINT usuarios_plan_actual_check;
  END IF;
  ALTER TABLE usuarios ADD CONSTRAINT usuarios_plan_actual_check
    CHECK (plan_actual IN ('Gratuito', 'Pro', 'Empresa'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- =============================================
-- Plantillas
-- =============================================
CREATE TABLE IF NOT EXISTS plantillas (
  id_plantilla       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario         UUID NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  nombre_plantilla   VARCHAR(255) NOT NULL,
  estructura_bloques JSONB NOT NULL DEFAULT '[]',
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- Contratos (Iteraciones)
-- =============================================
CREATE TABLE IF NOT EXISTS contratos (
  id_contrato      SERIAL PRIMARY KEY,
  id_usuario       UUID NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  id_plantilla     UUID REFERENCES plantillas(id_plantilla) ON DELETE SET NULL,
  titulo_contrato  VARCHAR(255) NOT NULL,
  datos_ingresados JSONB DEFAULT '{}',
  estado           VARCHAR(10) CHECK (estado IN ('Pendiente', 'Firmado')) DEFAULT 'Pendiente',
  fecha_creacion   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  firma_digital    TEXT,
  email_cliente    VARCHAR(255),
  pdf_url          TEXT
);

-- =============================================
-- Pagos (Auditoría de pagos MercadoPago)
-- =============================================
CREATE TABLE IF NOT EXISTS pagos (
  id                  SERIAL PRIMARY KEY,
  usuario_id          UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  mp_payment_id       VARCHAR(255),
  mp_preapproval_id   VARCHAR(255),
  monto_ars           DECIMAL(10,2),
  estado              VARCHAR(50),
  fecha               TIMESTAMP DEFAULT NOW(),
  payload_completo    JSONB
);
