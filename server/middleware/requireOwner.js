const requireOwner = (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  if (req.usuario.tenant_role !== 'owner') {
    return res.status(403).json({ error: 'Solo el owner del tenant puede realizar esta acción' });
  }
  next();
};

module.exports = requireOwner;
