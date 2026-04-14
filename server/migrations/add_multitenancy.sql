-- ================================================
-- Migración: Sistema Multi-Tenant (Plan Empresa)
-- ================================================

-- 1. Renombrar valor de rol superadmin para evitar colisión
--    El rol 'admin' existente pasa a ser 'superadmin'
UPDATE usuarios SET rol = 'superadmin' WHERE rol = 'admin';

-- 2. Tabla de Tenants (empresas)
CREATE TABLE IF NOT EXISTS tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          VARCHAR(255) NOT NULL,
    owner_id        UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 3. Tabla de Invitaciones pendientes
CREATE TABLE IF NOT EXISTS tenant_invitations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL,
    token           VARCHAR(255) UNIQUE NOT NULL,
    invited_by      UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    permisos        JSONB NOT NULL DEFAULT '{}',
    expires_at      TIMESTAMP NOT NULL,
    accepted_at     TIMESTAMP DEFAULT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 4. Tabla de Permisos por miembro
CREATE TABLE IF NOT EXISTS tenant_member_permissions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id              UUID NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    can_crear_contratos     BOOLEAN NOT NULL DEFAULT TRUE,
    can_editar_contratos    BOOLEAN NOT NULL DEFAULT TRUE,
    can_eliminar_contratos  BOOLEAN NOT NULL DEFAULT FALSE,
    can_crear_plantillas    BOOLEAN NOT NULL DEFAULT FALSE,
    can_editar_plantillas   BOOLEAN NOT NULL DEFAULT FALSE,
    can_firmar_contratos    BOOLEAN NOT NULL DEFAULT TRUE,
    can_descargar_pdf       BOOLEAN NOT NULL DEFAULT TRUE,
    can_ver_equipo          BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(usuario_id, tenant_id)
);

-- 5. Extender tabla usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tenant_role VARCHAR(20) DEFAULT NULL;
-- tenant_role: 'owner' | 'member' | NULL (usuario independiente sin equipo)

-- 6. Extender plantillas con tenant_id
ALTER TABLE plantillas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

-- 7. Extender contratos con tenant_id
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

-- 8. Índices de performance
CREATE INDEX IF NOT EXISTS idx_usuarios_tenant ON usuarios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contratos_tenant ON contratos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plantillas_tenant ON plantillas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON tenant_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON tenant_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_member_permissions_usuario ON tenant_member_permissions(usuario_id);
