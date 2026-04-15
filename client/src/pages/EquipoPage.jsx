import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import '../styles/components/_equipo.scss';

const PERMISOS_LABELS = {
    can_crear_contratos:    'Crear contratos',
    can_editar_contratos:   'Editar contratos',
    can_eliminar_contratos: 'Eliminar contratos',
    can_crear_plantillas:   'Crear plantillas',
    can_editar_plantillas:  'Editar plantillas',
    can_firmar_contratos:   'Firmar contratos',
    can_descargar_pdf:      'Descargar PDF',
    can_ver_equipo:         'Ver contratos del equipo',
};

function ModalPermisos({ miembro, onClose, onSave }) {
    const [permisos, setPermisos] = useState({ ...miembro });
    const [saving, setSaving] = useState(false);

    const handleToggle = (key) => {
        setPermisos(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async () => {
        setSaving(true);
        await onSave(permisos);
        setSaving(false);
    };

    return (
        <div className="equipo-permisos-modal-overlay" onClick={onClose}>
            <div className="equipo-permisos-modal" onClick={e => e.stopPropagation()}>
                <h3>Permisos de {miembro.nombre || miembro.email}</h3>
                {Object.keys(PERMISOS_LABELS).map(key => (
                    <div className="equipo-permiso-row" key={key}>
                        <label>{PERMISOS_LABELS[key]}</label>
                        <input
                            type="checkbox"
                            checked={!!permisos[key]}
                            onChange={() => handleToggle(key)}
                        />
                    </div>
                ))}
                <div className="equipo-permisos-acciones">
                    <button className="btn-cancelar" onClick={onClose}>Cancelar</button>
                    <button className="btn-guardar" onClick={handleSave} disabled={saving}>
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function EquipoPage() {
    const navigate = useNavigate();
    const [usuario, setUsuario] = useState(null);
    const [loading, setLoading] = useState(true);
    const [miembros, setMiembros] = useState([]);
    const [pendientes, setPendientes] = useState([]);
    const [emailInvitar, setEmailInvitar] = useState('');
    const [invitando, setInvitando] = useState(false);
    const [invitarMsg, setInvitarMsg] = useState({ tipo: '', texto: '' });
    const [modalPermisos, setModalPermisos] = useState(null); // miembro obj | null
    const [eliminando, setEliminando] = useState(null); // id | null

    useEffect(() => {
        verificarSesion();
    }, []);

    const verificarSesion = async () => {
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            if (!res.ok) { navigate('/login'); return; }
            const data = await res.json();
            if (data.usuario.tenant_role !== 'owner') {
                navigate('/home');
                return;
            }
            setUsuario(data.usuario);
            cargarMiembros();
        } catch {
            navigate('/login');
        } finally {
            setLoading(false);
        }
    };

    const cargarMiembros = async () => {
        try {
            const res = await fetch('/api/tenant/miembros', { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) return;
            setMiembros(data.miembros.filter(m => m.tenant_role === 'member'));
            setPendientes(data.invitaciones_pendientes);
        } catch { /* silencioso */ }
    };

    const handleInvitar = async (e) => {
        e.preventDefault();
        setInvitarMsg({ tipo: '', texto: '' });
        if (!emailInvitar.trim()) return;
        setInvitando(true);
        try {
            const res = await fetch('/api/tenant/invitar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: emailInvitar.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setInvitarMsg({ tipo: 'error', texto: data.error || 'Error al enviar invitación.' });
                return;
            }
            setInvitarMsg({ tipo: 'success', texto: 'Invitación enviada correctamente.' });
            setEmailInvitar('');
            cargarMiembros();
        } catch {
            setInvitarMsg({ tipo: 'error', texto: 'Error de conexión.' });
        } finally {
            setInvitando(false);
        }
    };

    const handleGuardarPermisos = async (permisos) => {
        try {
            const res = await fetch(`/api/tenant/miembros/${modalPermisos.id}/permisos`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(permisos),
            });
            if (res.ok) {
                setModalPermisos(null);
                cargarMiembros();
            }
        } catch { /* silencioso */ }
    };

    const handleEliminar = async (id) => {
        if (!window.confirm('¿Seguro que querés eliminar este miembro del equipo?')) return;
        setEliminando(id);
        try {
            const res = await fetch(`/api/tenant/miembros/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (res.ok) cargarMiembros();
        } catch { /* silencioso */ } finally {
            setEliminando(null);
        }
    };

    if (loading) return null;

    return (
        <>
            <Navbar usuario={usuario} />
            <div className="equipo-page">
                <div className="equipo-header">
                    <h1>Gestión de equipo</h1>
                    <p>Invitá miembros y administrá sus permisos.</p>
                </div>

                <div className="equipo-section">
                    <h2>Invitar miembro</h2>
                    <form className="equipo-invitar-form" onSubmit={handleInvitar}>
                        <input
                            type="email"
                            placeholder="email@ejemplo.com"
                            value={emailInvitar}
                            onChange={e => setEmailInvitar(e.target.value)}
                            required
                        />
                        <button type="submit" disabled={invitando}>
                            {invitando ? 'Enviando...' : 'Enviar invitación'}
                        </button>
                    </form>
                    {invitarMsg.texto && (
                        <p className={`equipo-msg ${invitarMsg.tipo}`}>{invitarMsg.texto}</p>
                    )}
                </div>

                <div className="equipo-section">
                    <h2>Miembros activos</h2>
                    {miembros.length === 0 ? (
                        <div className="equipo-empty">
                            Todavía no hay miembros en el equipo. Enviá una invitación para comenzar.
                        </div>
                    ) : (
                        miembros.map(m => (
                            <div className="equipo-miembro-card" key={m.id}>
                                <div className="equipo-miembro-info">
                                    <span className="equipo-miembro-nombre">{m.nombre || '—'}</span>
                                    <span className="equipo-miembro-email">{m.email}</span>
                                    <span className="equipo-miembro-rol">{m.tenant_role}</span>
                                </div>
                                <div className="equipo-miembro-acciones">
                                    <button onClick={() => setModalPermisos(m)}>Permisos</button>
                                    <button
                                        className="btn-danger"
                                        disabled={eliminando === m.id}
                                        onClick={() => handleEliminar(m.id)}
                                    >
                                        {eliminando === m.id ? '...' : 'Eliminar'}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {pendientes.length > 0 && (
                    <div className="equipo-section">
                        <h2>Invitaciones pendientes</h2>
                        {pendientes.map((inv, i) => (
                            <div className="equipo-pendiente-item" key={i}>
                                <span>{inv.email}</span>
                                <span>Expira: {new Date(inv.expires_at).toLocaleDateString('es-AR')}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {modalPermisos && (
                <ModalPermisos
                    miembro={modalPermisos}
                    onClose={() => setModalPermisos(null)}
                    onSave={handleGuardarPermisos}
                />
            )}
        </>
    );
}

export default EquipoPage;
