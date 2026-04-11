import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ActionMenu from '../components/ActionMenu';
import '../styles/components/_home.scss';

function HomePage() {
    const [usuario, setUsuario] = useState(null);
    const [loading, setLoading] = useState(true);
    const [contratos, setContratos] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [totalContratos, setTotalContratos] = useState(0);
    const [menuData, setMenuData] = useState(null); // { contrato, position }
    const [buscar, setBuscar] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');
    const [buscarInput, setBuscarInput] = useState('');
    const scrollRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        verificarSesion();
    }, []);

    const verificarSesion = async () => {
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            if (!res.ok) {
                navigate('/');
                return;
            }
            const data = await res.json();
            setUsuario(data.usuario);
            cargarContratos(1, {});
        } catch (err) {
            navigate('/');
        } finally {
            setLoading(false);
        }
    };

    const cargarContratos = async (pageNum, params = {}) => {
        try {
            if (pageNum > 1) setLoadingMore(true);
            let url = `/api/contratos?page=${pageNum}&limit=20`;
            if (params.buscar) url += `&buscar=${encodeURIComponent(params.buscar)}`;
            if (params.filtroEstado) url += `&estado=${params.filtroEstado}`;
            const res = await fetch(url, { credentials: 'include' });
            const data = await res.json();

            if (pageNum === 1) {
                setContratos(data.contratos);
            } else {
                setContratos((prev) => [...prev, ...data.contratos]);
            }
            setTotalContratos(data.total);
            setHasMore(data.hasMore);
            setPage(pageNum);
        } catch (err) {
            console.error('Error cargando contratos:', err);
        } finally {
            setLoadingMore(false);
        }
    };

    // Infinite scroll handler
    const handleScroll = useCallback(() => {
        if (!scrollRef.current || loadingMore || !hasMore) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 100) {
            cargarContratos(page + 1, { buscar, filtroEstado });
        }
    }, [loadingMore, hasMore, page, buscar, filtroEstado]);

    useEffect(() => {
        const el = scrollRef.current;
        if (el) {
            el.addEventListener('scroll', handleScroll);
            return () => el.removeEventListener('scroll', handleScroll);
        }
    }, [handleScroll]);

    const handleBuscar = () => {
        setBuscar(buscarInput);
        setPage(1);
        setContratos([]);
        setHasMore(true);
        cargarContratos(1, { buscar: buscarInput, filtroEstado });
    };

    const handleFiltroEstado = (nuevoEstado) => {
        const valor = nuevoEstado === filtroEstado ? '' : nuevoEstado;
        setFiltroEstado(valor);
        setPage(1);
        setContratos([]);
        setHasMore(true);
        cargarContratos(1, { buscar, filtroEstado: valor });
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        } catch (err) { /* logout anyway */ }
        navigate('/');
    };

    const handleOpenMenu = (e, contrato) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMenuData({
            contrato,
            position: { x: rect.left - 160, y: rect.bottom + 4 },
        });
    };

    const handleAction = async (action, contrato) => {
        setMenuData(null);

        switch (action) {
            case 'previsualizar': {
                try {
                    const res = await fetch(`/api/contratos/${contrato.id_contrato}/pdf?modo=preview`, {
                        credentials: 'include',
                    });
                    if (!res.ok) {
                        let errorMsg = 'Error al generar el PDF.';
                        try {
                            const errData = await res.json();
                            errorMsg = errData.error || errorMsg;
                        } catch (_) { /* not JSON */ }
                        alert(errorMsg);
                        break;
                    }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    // Liberar el blob URL después de un breve delay para que la pestaña cargue
                    setTimeout(() => URL.revokeObjectURL(url), 10000);
                } catch (err) {
                    console.error('Error previsualizando PDF:', err);
                    alert('Error de conexión al generar el PDF.');
                }
                break;
            }

            case 'descargar': {
                try {
                    const res = await fetch(`/api/contratos/${contrato.id_contrato}/pdf?modo=download`, {
                        credentials: 'include',
                    });
                    if (!res.ok) {
                        let errorMsg = 'Error al descargar el PDF.';
                        try {
                            const errData = await res.json();
                            errorMsg = errData.error || errorMsg;
                        } catch (_) { /* not JSON */ }
                        alert(errorMsg);
                        break;
                    }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `contrato_${contrato.id_contrato}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                } catch (err) {
                    console.error('Error descargando PDF:', err);
                    alert('Error de conexión al descargar el PDF.');
                }
                break;
            }

            case 'firmar':
                navigate(`/firmar/${contrato.id_contrato}`);
                break;

            case 'editar':
                if (contrato.estado !== 'Firmado') {
                    navigate(`/contrato/editar/${contrato.id_contrato}`);
                }
                break;

            case 'eliminar':
                if (window.confirm(`¿Eliminar el contrato "${contrato.titulo_contrato}"?`)) {
                    try {
                        await fetch(`/api/contratos/${contrato.id_contrato}`, {
                            method: 'DELETE',
                            credentials: 'include',
                        });
                        setContratos((prev) => prev.filter((c) => c.id_contrato !== contrato.id_contrato));
                        setTotalContratos((prev) => prev - 1);
                    } catch (err) {
                        console.error('Error eliminando contrato:', err);
                    }
                }
                break;
        }
    };

    const formatDate = () => {
        return new Date().toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
        });
    };

    if (loading) {
        return (
            <div className="home-page">
                <div className="loading-screen">
                    <div className="spinner" />
                </div>
            </div>
        );
    }

    return (
        <div className="home-page">
            {/* Header */}
            <header className="home-header">
                <div className="header-info">
                    <h1>Panel Principal</h1>
                    <p>{formatDate()}</p>
                </div>
                <div className="header-actions">
                    <button className="icon-btn" title="Cerrar sesión" onClick={handleLogout}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* Contracts Table */}
            <div className="contracts-table-container">
                <div className="table-header-bar">
                    <h2>Mis Contratos</h2>
                    <span className="contract-count">{totalContratos} contrato{totalContratos !== 1 ? 's' : ''}</span>
                </div>

                <div className="contracts-filters">
                    <form onSubmit={(e) => { e.preventDefault(); handleBuscar(); }}>
                        <input
                            type="text"
                            placeholder="Buscar por título..."
                            value={buscarInput}
                            onChange={(e) => setBuscarInput(e.target.value)}
                            className="filter-search-input"
                        />
                        <button type="submit" className="filter-search-btn">Buscar</button>
                    </form>
                    <div className="filter-estado-group">
                        <button
                            type="button"
                            className={`filter-btn${filtroEstado === '' ? ' active' : ''}`}
                            onClick={() => handleFiltroEstado('')}
                        >
                            Todos
                        </button>
                        <button
                            type="button"
                            className={`filter-btn${filtroEstado === 'Pendiente' ? ' active' : ''}`}
                            onClick={() => handleFiltroEstado('Pendiente')}
                        >
                            Pendiente
                        </button>
                        <button
                            type="button"
                            className={`filter-btn${filtroEstado === 'Firmado' ? ' active' : ''}`}
                            onClick={() => handleFiltroEstado('Firmado')}
                        >
                            Firmado
                        </button>
                    </div>
                </div>

                <div className="table-scroll" ref={scrollRef}>
                    {contratos.length === 0 && !loadingMore ? (
                        <div className="empty-table">
                            <div className="empty-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                            </div>
                            <h3>Sin contratos aún</h3>
                            <p>Crea tu primera plantilla y luego genera un contrato desde el menú inferior.</p>
                        </div>
                    ) : (
                        <table className="contracts-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Título</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {contratos.map((contrato) => (
                                    <tr
                                        key={contrato.id_contrato}
                                        className={`estado-${contrato.estado.toLowerCase()}`}
                                    >
                                        <td className="col-id">#{contrato.id_contrato}</td>
                                        <td className="col-titulo">
                                            <span className="titulo-text">{contrato.titulo_contrato}</span>
                                            <span className={`estado-badge ${contrato.estado.toLowerCase()}`}>
                                                {contrato.estado}
                                            </span>
                                        </td>
                                        <td className="col-acciones">
                                            <button
                                                className="action-trigger"
                                                onClick={(e) => handleOpenMenu(e, contrato)}
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="1" />
                                                    <circle cx="12" cy="5" r="1" />
                                                    <circle cx="12" cy="19" r="1" />
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {loadingMore && (
                        <div className="loading-more">
                            <span className="mini-spinner" />
                            Cargando más...
                        </div>
                    )}
                </div>
            </div>

            {/* Navbar */}
            <Navbar usuario={usuario} />

            {/* Action Menu */}
            {menuData && (
                <ActionMenu
                    contrato={menuData.contrato}
                    position={menuData.position}
                    onClose={() => setMenuData(null)}
                    onAction={handleAction}
                />
            )}
        </div>
    );
}

export default HomePage;
