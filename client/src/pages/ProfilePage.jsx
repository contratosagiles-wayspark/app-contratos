import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/components/_pages.scss';

function ProfilePage() {
    const navigate = useNavigate();
    const [usuario, setUsuario] = useState(null);
    const [loading, setLoading] = useState(true);
    const [contrasenaActual, setContrasenaActual] = useState('');
    const [contrasenaNueva, setContrasenaNueva] = useState('');
    const [contrasenaNueva2, setContrasenaNueva2] = useState('');
    const [passwordMsg, setPasswordMsg] = useState('');
    const [passwordErr, setPasswordErr] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        cargarPerfil();
    }, []);

    const cargarPerfil = async () => {
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            if (!res.ok) {
                navigate('/');
                return;
            }
            const data = await res.json();
            setUsuario(data.usuario);
        } catch (err) {
            navigate('/');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        } catch (err) { /* logout anyway */ }
        navigate('/');
    };

    const cambiarContrasena = async () => {
        setPasswordMsg('');
        setPasswordErr('');

        if (!contrasenaActual || !contrasenaNueva) {
            setPasswordErr('Todos los campos son obligatorios.');
            return;
        }
        if (contrasenaNueva !== contrasenaNueva2) {
            setPasswordErr('Las contraseñas nuevas no coinciden.');
            return;
        }
        if (contrasenaNueva.length < 6) {
            setPasswordErr('La nueva contraseña debe tener al menos 6 caracteres.');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/auth/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    contrasena_actual: contrasenaActual,
                    contrasena_nueva: contrasenaNueva,
                }),
            });
            const data = await res.json();

            if (!res.ok) {
                setPasswordErr(data.error || 'Error al cambiar contraseña.');
            } else {
                setPasswordMsg('✅ Contraseña actualizada exitosamente.');
                setContrasenaActual('');
                setContrasenaNueva('');
                setContrasenaNueva2('');
            }
        } catch (err) {
            setPasswordErr('Error de conexión.');
        } finally {
            setSaving(false);
        }
    };

    const getInitials = (email) => email ? email.substring(0, 2).toUpperCase() : '??';

    const contratosUsados = usuario?.contratos_usados_mes || 0;
    const plantillasCreadas = usuario?.plantillas_creadas || 0;
    const esGratuito = usuario?.plan_actual === 'Gratuito';

    const contratosPercent = esGratuito ? Math.min((contratosUsados / 15) * 100, 100) : 0;
    const plantillasPercent = esGratuito ? Math.min((plantillasCreadas / 1) * 100, 100) : 0;

    if (loading) {
        return (
            <div className="profile-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#16A34A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
        );
    }

    return (
        <div className="profile-page">
            <div className="page-header">
                <button className="back-btn" onClick={() => navigate('/home')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <h1>Mi Perfil</h1>
                <div className="spacer" />
            </div>

            {/* User Card */}
            <div className="profile-card">
                <div className="avatar-large">{getInitials(usuario?.email)}</div>
                <div className="profile-email">{usuario?.email}</div>
                <div className="profile-since">
                    Miembro desde {new Date(usuario?.created_at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </div>
            </div>

            {/* Plan Section */}
            <div className="section-card">
                <h3>Mi Plan</h3>

                <div className="plan-current">
                    <span className="plan-name">{usuario?.plan_actual}</span>
                    <span className="plan-badge-large">{usuario?.plan_actual}</span>
                </div>

                {esGratuito && (
                    <>
                        <div className="progress-item">
                            <div className="progress-label">
                                <span>Contratos este mes</span>
                                <span>{contratosUsados}/15</span>
                            </div>
                            <div className="progress-bar">
                                <div
                                    className={`progress-fill ${contratosPercent >= 80 ? 'danger' : contratosPercent >= 60 ? 'warning' : ''}`}
                                    style={{ width: `${contratosPercent}%` }}
                                />
                            </div>
                        </div>

                        <div className="progress-item">
                            <div className="progress-label">
                                <span>Plantillas creadas</span>
                                <span>{plantillasCreadas}/1</span>
                            </div>
                            <div className="progress-bar">
                                <div
                                    className={`progress-fill ${plantillasPercent >= 100 ? 'danger' : ''}`}
                                    style={{ width: `${plantillasPercent}%` }}
                                />
                            </div>
                        </div>

                        <div className="upgrade-benefits">
                            <strong>✨ Beneficios del Plan Pro:</strong><br />
                            • Plantillas y contratos ilimitados<br />
                            • Marca blanca en PDFs y correos<br />
                            • Soporte prioritario
                        </div>

                        <button className="upgrade-btn">
                            🚀 Pasarse a Pro
                        </button>
                    </>
                )}
            </div>

            {/* Password Section */}
            <div className="section-card">
                <h3>Cambiar Contraseña</h3>

                <div className="form-group">
                    <label>Contraseña actual</label>
                    <input
                        type="password"
                        value={contrasenaActual}
                        onChange={(e) => setContrasenaActual(e.target.value)}
                        placeholder="••••••"
                    />
                </div>

                <div className="form-group">
                    <label>Nueva contraseña</label>
                    <input
                        type="password"
                        value={contrasenaNueva}
                        onChange={(e) => setContrasenaNueva(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                    />
                </div>

                <div className="form-group">
                    <label>Confirmar nueva contraseña</label>
                    <input
                        type="password"
                        value={contrasenaNueva2}
                        onChange={(e) => setContrasenaNueva2(e.target.value)}
                        placeholder="Repite la nueva contraseña"
                    />
                </div>

                <button
                    className="save-password-btn"
                    onClick={cambiarContrasena}
                    disabled={saving}
                >
                    {saving ? 'Guardando...' : 'Cambiar contraseña'}
                </button>

                {passwordMsg && <p className="success-msg">{passwordMsg}</p>}
                {passwordErr && <p className="error-msg">{passwordErr}</p>}
            </div>

            {/* Logout */}
            <button className="logout-btn" onClick={handleLogout}>
                Cerrar Sesión
            </button>
        </div>
    );
}

export default ProfilePage;
