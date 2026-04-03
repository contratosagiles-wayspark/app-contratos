-- =============================================
-- Migración: Añadir branding a plantillas (y contratos para snapshot)
-- =============================================

-- Tabla: plantillas
ALTER TABLE plantillas ADD COLUMN IF NOT EXISTS marca_agua VARCHAR(255) DEFAULT NULL;
ALTER TABLE plantillas ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500) DEFAULT NULL;
ALTER TABLE plantillas ADD COLUMN IF NOT EXISTS logo_posicion VARCHAR(20) DEFAULT NULL CHECK (logo_posicion IN ('izquierda', 'centro', 'derecha') OR logo_posicion IS NULL);
ALTER TABLE plantillas ADD COLUMN IF NOT EXISTS footer_texto TEXT DEFAULT NULL;

-- Tabla: contratos (para el snapshot del diseño)
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS marca_agua VARCHAR(255) DEFAULT NULL;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500) DEFAULT NULL;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS logo_posicion VARCHAR(20) DEFAULT NULL CHECK (logo_posicion IN ('izquierda', 'centro', 'derecha') OR logo_posicion IS NULL);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS footer_texto TEXT DEFAULT NULL;
