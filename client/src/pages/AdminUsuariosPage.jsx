import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/components/_admin.scss';

function AdminUsuariosPage() {
    const navigate = useNavigate();
    const [usuarios, setUsuarios] = useState([]);
    const [total, setTotal] = useState(0);
    const [pagina, setPagina] = useState(1);
    const [paginasTotales, setPaginasTotales] = useState(1);
    const [loading, setLoading] = useState(true);
    const [buscar, setBuscar] = useState('');
    const [filtroPlan, setFiltroPlan] = useState('');
    const limit = 20;

    useEffect(() => {
        fetchUsuarios();
    }, [pagina, filtroPlan]);

    const fetchUsuarios = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagina.toString(),
                limit: limit.toString(),
            });
            if (filtroPlan) params.set('plan', filtroPlan);
            if (buscar.trim()) params.set('buscar', buscar.trim());

            const res = await fetch(`/api/admin/usuarios?${params}`, { credentials: 'include' });
            if (res.status === 401) {
                navigate('/');
                return;
            }
            if (res.status === 403) {
                navigate('/home');
                return;
            }
            if (!res.ok) throw new Error('Error al cargar usuarios');
            const data = await res.json();
            setUsuarios(data.usuarios);
            setTotal(data.total);
            setPaginasTotales(data.paginas_totales);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleBuscar = (e) => {
        e.preventDefault();
        setPagina(1);
        fetchUsuarios();
    };

    const planBadgeClass = (plan) => {
        switch (plan) {
            case 'pro': return 'badge-pro';
            case 'empresa': return 'badge-empresa';
            default: return 'badge-gratis';
        }
    };

    const estadoBadgeClass = (estado, trialHasta) => {
        if (trialHasta && new Date(trialHasta) > new Date()) return 'badge-trial';
        switch (estado) {
            case 'activo': return 'badge-activo';
            case 'suspendido': return 'badge-suspendido';
            case 'cancelado': return 'badge-cancelado';
            default: return '';
        }
    };

    const estadoLabel = (estado, trialHasta) => {
        if (trialHasta && new Date(trialHasta) > new Date()) return 'Trial';
        switch (estado) {
            case 'activo': return 'Activo';
            case 'suspendido': return 'Suspendido';
            case 'cancelado': return 'Cancelado';
            default: return estado;
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    };

    const planLabel = (plan) => {
        switch (plan) {
            case 'pro': return 'Pro';
            case 'empresa': return 'Empresa';
            default: return 'Gratuito';
        }
    };

    return (
        <div className="admin-page">
            <div className="admin-header">
                <button className="back-btn" onClick={() => navigate('/admin')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <h1>Usuarios ({total})</h1>
                <div className="spacer" />
            </div>

            {/* Filtros */}
            <div className="admin-filters">
                <form onSubmit={handleBuscar} className="search-form">
                    <input
                        id="search-users"
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        value={buscar}
                        onChange={(e) => setBuscar(e.target.value)}
                    />
                    <button type="submit" id="btn-search">Buscar</button>
                </form>

                <select
                    id="filter-plan"
                    value={filtroPlan}
                    onChange={(e) => { setFiltroPlan(e.target.value); setPagina(1); }}
                >
                    <option value="">Todos los planes</option>
                    <option value="gratis">Gratuito</option>
                    <option value="pro">Pro</option>
                    <option value="empresa">Empresa</option>
                </select>
            </div>

            {/* Tabla */}
            {loading ? (
                <div className="admin-loading"><div className="spinner" /></div>
            ) : (
                <>
                    <div className="admin-table-wrapper">
                        <table className="admin-table" id="users-table">
                            <thead>
                                <tr>
                                    <th>Nombre / Email</th>
                                    <th>Plan</th>
                                    <th>Estado</th>
                                    <th>Trial hasta</th>
                                    <th>Contratos/mes</th>
                                    <th>Registro</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuarios.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="empty-row">
                                            No se encontraron usuarios
                                        </td>
                                    </tr>
                                ) : (
                                    usuarios.map(u => (
                                        <tr key={u.id}>
                                            <td className="user-cell">
                                                <div className="user-name">{u.nombre}</div>
                                                <div className="user-email">{u.email}</div>
                                            </td>
                                            <td>
                                                <span className={`badge ${planBadgeClass(u.plan)}`}>
                                                    {planLabel(u.plan)}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge ${estadoBadgeClass(u.plan_estado, u.trial_hasta)}`}>
                                                    {estadoLabel(u.plan_estado, u.trial_hasta)}
                                                </span>
                                            </td>
                                            <td>{formatDate(u.trial_hasta)}</td>
                                            <td className="center">{u.contratos_usados_mes}</td>
                                            <td>{formatDate(u.creado_en)}</td>
                                            <td>
                                                <button
                                                    className="btn-detail"
                                                    onClick={() => navigate(`/admin/usuarios/${u.id}`)}
                                                >
                                                    Ver detalle
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Paginación */}
                    {paginasTotales > 1 && (
                        <div className="admin-pagination">
                            <button
                                disabled={pagina <= 1}
                                onClick={() => setPagina(p => p - 1)}
                            >
                                ← Anterior
                            </button>
                            <span>Página {pagina} de {paginasTotales}</span>
                            <button
                                disabled={pagina >= paginasTotales}
                                onClick={() => setPagina(p => p + 1)}
                            >
                                Siguiente →
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default AdminUsuariosPage;
