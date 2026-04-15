const { pool } = require('../db/pool');

/**
 * Middleware que enriquece req.usuario con los permisos del tenant.
 * - Si el usuario es owner: adjunta permisos totales implícitos (sin consultar DB)
 * - Si el usuario es member: consulta tenant_member_permissions y adjunta
 * - Si el usuario no tiene tenant (plan Gratuito/Pro): no hace nada
 * Debe usarse DESPUÉS de requireAuth.
 */
const loadTenantPermisos = async (req, res, next) => {
  if (!req.usuario) return next();

  const { tenant_id, tenant_role } = req.usuario;

  // Usuario sin tenant: no tocar nada
  if (!tenant_id || !tenant_role) {
    req.usuario.permisos = null;
    return next();
  }

  // Owner: permisos totales implícitos
  if (tenant_role === 'owner') {
    req.usuario.permisos = {
      can_crear_contratos: true,
      can_editar_contratos: true,
      can_eliminar_contratos: true,
      can_crear_plantillas: true,
      can_editar_plantillas: true,
      can_firmar_contratos: true,
      can_descargar_pdf: true,
      can_ver_equipo: true,
    };
    return next();
  }

  // Member: buscar permisos en DB
  try {
    const result = await pool.query(
      `SELECT can_crear_contratos, can_editar_contratos, can_eliminar_contratos,
              can_crear_plantillas, can_editar_plantillas, can_firmar_contratos,
              can_descargar_pdf, can_ver_equipo
       FROM tenant_member_permissions
       WHERE usuario_id = $1 AND tenant_id = $2`,
      [req.usuario.id, tenant_id]
    );

    if (result.rows.length === 0) {
      // Member sin fila de permisos: aplicar defaults seguros
      req.usuario.permisos = {
        can_crear_contratos: true,
        can_editar_contratos: true,
        can_eliminar_contratos: false,
        can_crear_plantillas: false,
        can_editar_plantillas: false,
        can_firmar_contratos: true,
        can_descargar_pdf: true,
        can_ver_equipo: false,
      };
    } else {
      req.usuario.permisos = result.rows[0];
    }

    next();
  } catch (err) {
    console.error('Error en loadTenantPermisos:', err);
    // Fail-safe: no bloquear la request, continuar sin permisos extendidos
    req.usuario.permisos = null;
    next();
  }
};

module.exports = { loadTenantPermisos };
