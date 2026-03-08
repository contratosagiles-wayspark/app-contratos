import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../styles/components/_admin.scss';

function AdminUsuarioDetallePage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Trial form
    const [trialDias, setTrialDias] = useState(14);
    const [trialNota, setTrialNota] = useState('');
    const [trialLoading, setTrialLoading] = useState(false);
    const [trialMsg, setTrialMsg] = useState('');

    // Plan form
    const [planNuevo, setPlanNuevo] = useState('');
    const [planEstado, setPlanEstado] = useState('activo');
    const [planMotivo, setPlanMotivo] = useState('');
    const [notificarUsuario, setNotificarUsuario] = useState(false);
    const [planLoading, setPlanLoading] = useState(false);
    const [planMsg, setPlanMsg] = useState('');

    // Nota form
    const [nuevaNota, setNuevaNota] = useState('');
    const [notaLoading, setNotaLoading] = useState(false);
    const [notaMsg, setNotaMsg] = useState('');

    useEffect(() => {
        fetchUsuario();
    }, [id]);

    const fetchUsuario = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/usuarios/${id}`, { credentials: 'include' });
            if (res.status === 401) {
                navigate('/');
                return;
            }
            if (res.status === 403) {
                navigate('/home');
                return;
            }
            if (!res.ok) throw new Error('Error al cargar usuario');
            const data = await res.json();
            setData(data);
            setPlanNuevo(data.usuario.plan);
            setPlanEstado(data.usuario.plan_estado);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleTrial = async () => {
        setTrialLoading(true);
        setTrialMsg('');
        try {
            const res = await fetch(`/api/admin/usuarios/${id}/trial`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ dias: trialDias, nota: trialNota }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            setTrialMsg(`✅ Trial activado hasta ${formatDate(result.trial_hasta)}`);
            setTrialNota('');
            fetchUsuario();
        } catch (err) {
            setTrialMsg(`❌ ${err.message}`);
        } finally {
            setTrialLoading(false);
        }
    };

    const handleCambiarPlan = async () => {
        setPlanLoading(true);
        setPlanMsg('');
        try {
            const res = await fetch(`/api/admin/usuarios/${id}/cambiar-plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    plan: planNuevo,
                    plan_estado: planEstado,
                    motivo: planMotivo,
                    notificar_usuario: notificarUsuario,
                }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            setPlanMsg(`✅ Plan actualizado a ${result.plan}`);
            setPlanMotivo('');
            fetchUsuario();
        } catch (err) {
            setPlanMsg(`❌ ${err.message}`);
        } finally {
            setPlanLoading(false);
        }
    };

    const handleAgregarNota = async () => {
        if (!nuevaNota.trim()) return;
        setNotaLoading(true);
        setNotaMsg('');
        try {
            const res = await fetch(`/api/admin/usuarios/${id}/nota`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ nota: nuevaNota }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            setNotaMsg('✅ Nota agregada');
            setNuevaNota('');
            fetchUsuario();
        } catch (err) {
            setNotaMsg(`❌ ${err.message}`);
        } finally {
            setNotaLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const formatMoney = (amount) => {
        if (!amount) return '$0';
        return new Intl.NumberFormat('es-AR', {
            style: 'currency', currency: 'ARS', minimumFractionDigits: 0,
        }).format(amount);
    };

    const planLabel = (plan) => {
        switch (plan) {
            case 'pro': return 'Pro';
            case 'empresa': return 'Empresa';
            default: return 'Gratuito';
        }
    };

    if (loading) {
        return (
            <div className="admin-page">
                <div className="admin-loading"><div className="spinner" /></div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="admin-page">
                <div className="admin-error">{error || 'Usuario no encontrado'}</div>
            </div>
        );
    }

    const { usuario, contratos_total, plantillas_total, ultimos_contratos, pagos } = data;

    return (
        <div className="admin-page">
            <div className="admin-header">
                <button className="back-btn" onClick={() => navigate('/admin/usuarios')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <h1>Detalle de Usuario</h1>
                <div className="spacer" />
            </div>

            <div className="admin-detail-layout">
                {/* ── Columna Izquierda: Info ── */}
                <div className="detail-left">
                    {/* Info del usuario */}
                    <div className="admin-detail-card" id="user-info-card">
                        <h3>Información</h3>
                        <div className="detail-row">
                            <span>Nombre</span>
                            <span className="detail-value">{usuario.nombre || '—'}</span>
                        </div>
                        <div className="detail-row">
                            <span>Email</span>
                            <span className="detail-value">{usuario.email}</span>
                        </div>
                        <div className="detail-row">
                            <span>Plan</span>
                            <span className="detail-value">{planLabel(usuario.plan)}</span>
                        </div>
                        <div className="detail-row">
                            <span>Estado</span>
                            <span className="detail-value">{usuario.plan_estado}</span>
                        </div>
                        <div className="detail-row">
                            <span>Trial hasta</span>
                            <span className="detail-value">{formatDate(usuario.trial_hasta)}</span>
                        </div>
                        <div className="detail-row">
                            <span>Suscripción MP</span>
                            <span className="detail-value">{usuario.suscripcion_mp_id || '—'}</span>
                        </div>
                        <div className="detail-row">
                            <span>Vencimiento plan</span>
                            <span className="detail-value">{formatDate(usuario.plan_vencimiento)}</span>
                        </div>
                        <div className="detail-row">
                            <span>Empresa</span>
                            <span className="detail-value">{usuario.nombre_empresa || '—'}</span>
                        </div>
                        <div className="detail-row">
                            <span>Contratos este mes</span>
                            <span className="detail-value">{usuario.contratos_usados_mes}</span>
                        </div>
                        <div className="detail-row">
                            <span>Contratos totales</span>
                            <span className="detail-value">{contratos_total}</span>
                        </div>
                        <div className="detail-row">
                            <span>Plantillas</span>
                            <span className="detail-value">{plantillas_total}</span>
                        </div>
                        <div className="detail-row">
                            <span>Registrado</span>
                            <span className="detail-value">{formatDate(usuario.creado_en)}</span>
                        </div>
                        {usuario.baja_motivo && (
                            <div className="detail-row">
                                <span>Motivo baja</span>
                                <span className="detail-value text-red">{usuario.baja_motivo}</span>
                            </div>
                        )}
                    </div>

                    {/* Últimos contratos */}
                    <div className="admin-detail-card" id="recent-contracts-card">
                        <h3>Últimos contratos</h3>
                        {ultimos_contratos.length === 0 ? (
                            <p className="text-muted">Sin contratos</p>
                        ) : (
                            <table className="admin-mini-table">
                                <thead>
                                    <tr>
                                        <th>Título</th>
                                        <th>Estado</th>
                                        <th>Fecha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ultimos_contratos.map(c => (
                                        <tr key={c.id}>
                                            <td>{c.titulo}</td>
                                            <td>
                                                <span className={`badge ${c.estado === 'Firmado' ? 'badge-activo' : 'badge-trial'}`}>
                                                    {c.estado}
                                                </span>
                                            </td>
                                            <td>{formatDate(c.fecha)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Historial de pagos */}
                    <div className="admin-detail-card" id="payments-card">
                        <h3>Historial de pagos</h3>
                        {pagos.length === 0 ? (
                            <p className="text-muted">Sin pagos registrados</p>
                        ) : (
                            <table className="admin-mini-table">
                                <thead>
                                    <tr>
                                        <th>ID Pago MP</th>
                                        <th>Monto</th>
                                        <th>Estado</th>
                                        <th>Fecha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagos.map(p => (
                                        <tr key={p.id}>
                                            <td className="mono">{p.mp_payment_id || '—'}</td>
                                            <td>{formatMoney(p.monto)}</td>
                                            <td>
                                                <span className={`badge ${p.estado === 'approved' ? 'badge-activo' : 'badge-suspendido'}`}>
                                                    {p.estado}
                                                </span>
                                            </td>
                                            <td>{formatDate(p.fecha)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* ── Columna Derecha: Acciones ── */}
                <div className="detail-right">
                    {/* Gestión de plan */}
                    <div className="admin-action-card" id="plan-management-card">
                        <h3>Gestión de Plan</h3>
                        <div className="action-form">
                            <div className="form-row">
                                <label>Plan actual:</label>
                                <select value={planNuevo} onChange={e => setPlanNuevo(e.target.value)}>
                                    <option value="gratis">Gratuito</option>
                                    <option value="pro">Pro</option>
                                    <option value="empresa">Empresa</option>
                                </select>
                            </div>
                            <div className="form-row">
                                <label>Estado:</label>
                                <select value={planEstado} onChange={e => setPlanEstado(e.target.value)}>
                                    <option value="activo">Activo</option>
                                    <option value="cancelado">Cancelado</option>
                                    <option value="suspendido">Suspendido</option>
                                </select>
                            </div>
                            <div className="form-row">
                                <label>Motivo:</label>
                                <input
                                    type="text"
                                    value={planMotivo}
                                    onChange={e => setPlanMotivo(e.target.value)}
                                    placeholder="Ej: Pago rechazado por el banco"
                                />
                            </div>
                            <div className="form-row checkbox-row">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={notificarUsuario}
                                        onChange={e => setNotificarUsuario(e.target.checked)}
                                    />
                                    ✉ Notificar usuario
                                </label>
                            </div>
                            <button
                                className="admin-btn"
                                onClick={handleCambiarPlan}
                                disabled={planLoading}
                                id="btn-save-plan"
                            >
                                {planLoading ? 'Guardando...' : 'Guardar cambio de plan'}
                            </button>
                            {planMsg && <p className="action-msg">{planMsg}</p>}
                        </div>
                    </div>

                    {/* Período de prueba */}
                    <div className="admin-action-card" id="trial-management-card">
                        <h3>Período de Prueba</h3>
                        <div className="action-form">
                            <div className="form-row">
                                <label>Días de trial:</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="365"
                                    value={trialDias}
                                    onChange={e => setTrialDias(parseInt(e.target.value) || 14)}
                                />
                            </div>
                            <div className="form-row">
                                <label>Nota:</label>
                                <input
                                    type="text"
                                    value={trialNota}
                                    onChange={e => setTrialNota(e.target.value)}
                                    placeholder="Ej: Trial por campaña de lanzamiento"
                                />
                            </div>
                            <button
                                className="admin-btn btn-trial"
                                onClick={handleTrial}
                                disabled={trialLoading}
                                id="btn-activate-trial"
                            >
                                {trialLoading ? 'Activando...' : 'Activar trial'}
                            </button>
                            {trialMsg && <p className="action-msg">{trialMsg}</p>}
                        </div>
                    </div>

                    {/* Notas internas */}
                    <div className="admin-action-card" id="notes-card">
                        <h3>Notas Internas</h3>
                        {usuario.notas_admin && (
                            <div className="notes-history">
                                <pre>{usuario.notas_admin}</pre>
                            </div>
                        )}
                        <div className="action-form">
                            <div className="form-row">
                                <label>Nueva nota:</label>
                                <textarea
                                    value={nuevaNota}
                                    onChange={e => setNuevaNota(e.target.value)}
                                    placeholder="Escribí una nota sobre este usuario..."
                                    rows={3}
                                />
                            </div>
                            <button
                                className="admin-btn"
                                onClick={handleAgregarNota}
                                disabled={notaLoading || !nuevaNota.trim()}
                                id="btn-add-note"
                            >
                                {notaLoading ? 'Guardando...' : 'Agregar nota'}
                            </button>
                            {notaMsg && <p className="action-msg">{notaMsg}</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminUsuarioDetallePage;
