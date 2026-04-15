-- 002_tenant_indexes_constraints.sql
-- Agrega índices de performance y constraint de integridad para el sistema multi-tenant
-- Idempotente: seguro de correr múltiples veces

-- Índice compuesto para lookups de permisos por miembro y tenant
CREATE INDEX IF NOT EXISTS idx_tmp_usuario_tenant
  ON tenant_member_permissions(usuario_id, tenant_id);

-- Índice en tenant_id de usuarios para joins de visibilidad
CREATE INDEX IF NOT EXISTS idx_usuarios_tenant_id
  ON usuarios(tenant_id);

-- Índice en token de invitaciones para lookup rápido al aceptar
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_token
  ON tenant_invitations(token);

-- CHECK constraint idempotente en tenant_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_usuarios_tenant_role'
  ) THEN
    ALTER TABLE usuarios
    ADD CONSTRAINT chk_usuarios_tenant_role
    CHECK (tenant_role IN ('owner', 'member') OR tenant_role IS NULL);
  END IF;
END $$;
