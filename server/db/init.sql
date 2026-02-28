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
  plan_actual           VARCHAR(10) CHECK (plan_actual IN ('Gratuito', 'Pro')) DEFAULT 'Gratuito',
  contratos_usados_mes  INT DEFAULT 0,
  plantillas_creadas    INT DEFAULT 0,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
