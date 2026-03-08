import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/components/_admin.scss';

function AdminDashboardPage() {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/admin/estadisticas', { credentials: 'include' });
            if (res.status === 401) {
                navigate('/');
                return;
            }
            if (res.status === 403) {
                navigate('/home');
                return;
            }
            if (!res.ok) throw new Error('Error al cargar estadísticas');
            const data = await res.json();
            setStats(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="admin-page">
                <div className="admin-loading">
                    <div className="spinner" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="admin-page">
                <div className="admin-error">{error}</div>
            </div>
        );
    }

    return (
        <div className="admin-page">
            <div className="admin-header">
                <button className="back-btn" onClick={() => navigate('/home')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <h1>Panel de Administración</h1>
                <div className="spacer" />
            </div>

            {/* Stats Cards */}
            <div className="admin-stats-grid">
                <div className="admin-stat-card" id="stat-total-users">
                    <div className="stat-icon">👥</div>
                    <div className="stat-value">{stats.usuarios.total}</div>
                    <div className="stat-label">Usuarios total</div>
                </div>

                <div className="admin-stat-card stat-pro" id="stat-pro-users">
                    <div className="stat-icon">⭐</div>
                    <div className="stat-value">{stats.usuarios.plan_pro}</div>
                    <div className="stat-label">Pro activos</div>
                </div>

                <div className="admin-stat-card stat-trial" id="stat-trial-users">
                    <div className="stat-icon">⏳</div>
                    <div className="stat-value">{stats.usuarios.en_trial}</div>
                    <div className="stat-label">En trial</div>
                </div>

                <div className="admin-stat-card stat-revenue" id="stat-revenue">
                    <div className="stat-icon">💰</div>
                    <div className="stat-value">{formatMoney(stats.ingresos.monto_total_mes_ars)}</div>
                    <div className="stat-label">Este mes</div>
                </div>
            </div>

            {/* Detalle */}
            <div className="admin-detail-grid">
                <div className="admin-detail-card" id="detail-users">
                    <h3>Usuarios</h3>
                    <div className="detail-row">
                        <span>Plan Gratuito</span>
                        <span className="detail-value">{stats.usuarios.plan_gratis}</span>
                    </div>
                    <div className="detail-row">
                        <span>Plan Pro</span>
                        <span className="detail-value">{stats.usuarios.plan_pro}</span>
                    </div>
                    <div className="detail-row">
                        <span>Plan Empresa</span>
                        <span className="detail-value">{stats.usuarios.plan_empresa}</span>
                    </div>
                    <div className="detail-row">
                        <span>En trial activo</span>
                        <span className="detail-value">{stats.usuarios.en_trial}</span>
                    </div>
                    <div className="detail-row">
                        <span>Nuevos (30 días)</span>
                        <span className="detail-value">{stats.usuarios.nuevos_ultimos_30_dias}</span>
                    </div>
                </div>

                <div className="admin-detail-card" id="detail-contracts">
                    <h3>Contratos</h3>
                    <div className="detail-row">
                        <span>Total histórico</span>
                        <span className="detail-value">{stats.contratos.total_historico}</span>
                    </div>
                    <div className="detail-row">
                        <span>Este mes</span>
                        <span className="detail-value">{stats.contratos.este_mes}</span>
                    </div>
                </div>

                <div className="admin-detail-card" id="detail-revenue">
                    <h3>Ingresos</h3>
                    <div className="detail-row">
                        <span>Pagos este mes</span>
                        <span className="detail-value">{stats.ingresos.pagos_este_mes}</span>
                    </div>
                    <div className="detail-row">
                        <span>Monto total</span>
                        <span className="detail-value">{formatMoney(stats.ingresos.monto_total_mes_ars)}</span>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <div className="admin-nav-section">
                <button className="admin-nav-btn" id="btn-manage-users" onClick={() => navigate('/admin/usuarios')}>
                    👥 Gestionar Usuarios
                </button>
            </div>
        </div>
    );
}

export default AdminDashboardPage;
