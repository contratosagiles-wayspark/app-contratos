const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Resend } = require('resend');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/authMiddleware');
const requireOwner = require('../middleware/requireOwner');

const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/tenant — Crear tenant (el usuario autenticado se vuelve owner)
// Reglas: solo usuarios con plan='Empresa', sin tenant_id previo
router.post('/', requireAuth, async (req, res) => {
  const { nombre } = req.body;
  const usuario = req.usuario;

  if (!nombre || nombre.trim() === '') {
    return res.status(400).json({ error: 'El nombre del tenant es requerido' });
  }
  if (usuario.plan !== 'Empresa') {
    return res.status(403).json({ error: 'Solo el plan Empresa puede crear un tenant' });
  }
  if (usuario.tenant_id) {
    return res.status(409).json({ error: 'Este usuario ya pertenece a un tenant' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tenantResult = await client.query(
      'INSERT INTO tenants (id, nombre, owner_id, created_at) VALUES (gen_random_uuid(), $1, $2, NOW()) RETURNING *',
      [nombre.trim(), usuario.id]
    );
    const tenant = tenantResult.rows[0];

    await client.query(
      'UPDATE usuarios SET tenant_id = $1, tenant_role = $2 WHERE id_usuario = $3',
      [tenant.id, 'owner', usuario.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ tenant });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creando tenant:', err);
    res.status(500).json({ error: 'Error interno al crear el tenant' });
  } finally {
    client.release();
  }
});

// GET /api/tenant — Obtener datos del tenant (accesible para owner y members)
router.get('/', requireAuth, async (req, res) => {
  const usuario = req.usuario;

  if (!usuario.tenant_id) {
    return res.status(404).json({ error: 'El usuario no pertenece a ningún tenant' });
  }

  try {
    const tenantResult = await pool.query(
      'SELECT * FROM tenants WHERE id = $1',
      [usuario.tenant_id]
    );
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }

    const memberCount = await pool.query(
      "SELECT COUNT(*) FROM usuarios WHERE tenant_id = $1 AND tenant_role = 'member'",
      [usuario.tenant_id]
    );

    res.json({
      tenant: tenantResult.rows[0],
      miembros_count: parseInt(memberCount.rows[0].count)
    });
  } catch (err) {
    console.error('Error obteniendo tenant:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/tenant/invitar — Enviar invitación por email a un nuevo miembro
router.post('/invitar', requireAuth, requireOwner, async (req, res) => {
  const { email, permisos } = req.body;
  const usuario = req.usuario;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  try {
    // Verificar que no sea miembro activo
    const miembroExistente = await pool.query(
      'SELECT id_usuario FROM usuarios WHERE email = $1 AND tenant_id = $2',
      [email, usuario.tenant_id]
    );
    if (miembroExistente.rows.length > 0) {
      return res.status(409).json({ error: 'Este email ya es miembro del tenant' });
    }

    // Verificar invitación pendiente no expirada
    const invitacionPendiente = await pool.query(
      'SELECT id FROM tenant_invitations WHERE email = $1 AND tenant_id = $2 AND accepted_at IS NULL AND expires_at > NOW()',
      [email, usuario.tenant_id]
    );
    if (invitacionPendiente.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe una invitación pendiente para este email' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const permisosDefault = {
      can_crear_contratos: true,
      can_editar_contratos: true,
      can_eliminar_contratos: false,
      can_crear_plantillas: false,
      can_editar_plantillas: false,
      can_firmar_contratos: true,
      can_descargar_pdf: true,
      can_ver_equipo: false,
      ...(permisos || {})
    };

    const tenantResult = await pool.query('SELECT nombre FROM tenants WHERE id = $1', [usuario.tenant_id]);
    const nombreTenant = tenantResult.rows[0]?.nombre || 'el equipo';

    await pool.query(
      `INSERT INTO tenant_invitations (id, tenant_id, email, token, invited_by, permisos, expires_at, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW() + INTERVAL '7 days', NOW())`,
      [usuario.tenant_id, email, token, usuario.id, JSON.stringify(permisosDefault)]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'https://www.contratosagiles.com';
    const linkInvitacion = `${frontendUrl}/register?token=${token}`;

    await resend.emails.send({
      from: 'ContratosAgiles <noreply@contratosagiles.com>',
      to: email,
      subject: `Te invitaron a unirte a ${nombreTenant} en ContratosAgiles`,
      html: `
        <p>Hola,</p>
        <p>${usuario.nombre || 'Un administrador'} te invitó a unirte a <strong>${nombreTenant}</strong> en ContratosAgiles.</p>
        <p><a href="${linkInvitacion}">Aceptar invitación</a></p>
        <p>Este link expira en 7 días.</p>
        <p>Si no esperabas esta invitación, podés ignorar este email.</p>
      `
    });

    res.status(201).json({ message: 'Invitación enviada correctamente' });
  } catch (err) {
    console.error('Error enviando invitación:', err);
    res.status(500).json({ error: 'Error interno al enviar la invitación' });
  }
});

// GET /api/tenant/miembros — Listar miembros del tenant con sus permisos
router.get('/miembros', requireAuth, requireOwner, async (req, res) => {
  const usuario = req.usuario;

  try {
    const result = await pool.query(
      `SELECT u.id_usuario AS id, u.nombre, u.email, u.tenant_role, u.created_at,
              tmp.can_crear_contratos, tmp.can_editar_contratos, tmp.can_eliminar_contratos,
              tmp.can_crear_plantillas, tmp.can_editar_plantillas, tmp.can_firmar_contratos,
              tmp.can_descargar_pdf, tmp.can_ver_equipo
       FROM usuarios u
       LEFT JOIN tenant_member_permissions tmp ON tmp.usuario_id = u.id_usuario AND tmp.tenant_id = $1
       WHERE u.tenant_id = $1
       ORDER BY u.tenant_role DESC, u.created_at ASC`,
      [usuario.tenant_id]
    );

    const invitacionesPendientes = await pool.query(
      'SELECT email, permisos, expires_at, created_at FROM tenant_invitations WHERE tenant_id = $1 AND accepted_at IS NULL AND expires_at > NOW()',
      [usuario.tenant_id]
    );

    res.json({
      miembros: result.rows,
      invitaciones_pendientes: invitacionesPendientes.rows
    });
  } catch (err) {
    console.error('Error listando miembros:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// PUT /api/tenant/miembros/:id/permisos — Actualizar permisos de un miembro
router.put('/miembros/:id/permisos', requireAuth, requireOwner, async (req, res) => {
  const { id } = req.params;
  const usuario = req.usuario;
  const {
    can_crear_contratos, can_editar_contratos, can_eliminar_contratos,
    can_crear_plantillas, can_editar_plantillas, can_firmar_contratos,
    can_descargar_pdf, can_ver_equipo
  } = req.body;

  try {
    // Verificar que el miembro pertenece al tenant del owner
    const miembro = await pool.query(
      "SELECT id_usuario FROM usuarios WHERE id_usuario = $1 AND tenant_id = $2 AND tenant_role = 'member'",
      [id, usuario.tenant_id]
    );
    if (miembro.rows.length === 0) {
      return res.status(404).json({ error: 'Miembro no encontrado en este tenant' });
    }

    await pool.query(
      `INSERT INTO tenant_member_permissions
         (id, usuario_id, tenant_id, can_crear_contratos, can_editar_contratos, can_eliminar_contratos,
          can_crear_plantillas, can_editar_plantillas, can_firmar_contratos, can_descargar_pdf, can_ver_equipo)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (usuario_id, tenant_id) DO UPDATE SET
         can_crear_contratos = EXCLUDED.can_crear_contratos,
         can_editar_contratos = EXCLUDED.can_editar_contratos,
         can_eliminar_contratos = EXCLUDED.can_eliminar_contratos,
         can_crear_plantillas = EXCLUDED.can_crear_plantillas,
         can_editar_plantillas = EXCLUDED.can_editar_plantillas,
         can_firmar_contratos = EXCLUDED.can_firmar_contratos,
         can_descargar_pdf = EXCLUDED.can_descargar_pdf,
         can_ver_equipo = EXCLUDED.can_ver_equipo`,
      [
        id, usuario.tenant_id,
        can_crear_contratos ?? true, can_editar_contratos ?? true, can_eliminar_contratos ?? false,
        can_crear_plantillas ?? false, can_editar_plantillas ?? false, can_firmar_contratos ?? true,
        can_descargar_pdf ?? true, can_ver_equipo ?? false
      ]
    );

    res.json({ message: 'Permisos actualizados correctamente' });
  } catch (err) {
    console.error('Error actualizando permisos:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// DELETE /api/tenant/miembros/:id — Eliminar miembro del tenant
router.delete('/miembros/:id', requireAuth, requireOwner, async (req, res) => {
  const { id } = req.params;
  const usuario = req.usuario;

  if (id === usuario.id) {
    return res.status(400).json({ error: 'El owner no puede eliminarse a sí mismo del tenant' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const miembro = await client.query(
      "SELECT id_usuario FROM usuarios WHERE id_usuario = $1 AND tenant_id = $2 AND tenant_role = 'member'",
      [id, usuario.tenant_id]
    );
    if (miembro.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Miembro no encontrado en este tenant' });
    }

    await client.query(
      'DELETE FROM tenant_member_permissions WHERE usuario_id = $1 AND tenant_id = $2',
      [id, usuario.tenant_id]
    );

    await client.query(
      'UPDATE usuarios SET tenant_id = NULL, tenant_role = NULL WHERE id_usuario = $1',
      [id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Miembro eliminado del tenant correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error eliminando miembro:', err);
    res.status(500).json({ error: 'Error interno' });
  } finally {
    client.release();
  }
});

module.exports = router;
