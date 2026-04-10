import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { validatePassword } from '../utils/passwordValidation';
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
    const [upgrading, setUpgrading] = useState(null); // 'pro' | 'empresa' | null

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

    const handleUpgrade = async (plan) => {
        setUpgrading(plan);
        try {
            const res = await fetch('/api/suscripciones/crear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ plan }),
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.error || 'Error al crear la suscripción.');
                return;
            }

            // Redirigir al checkout de MercadoPago
            window.location.href = data.init_point;
        } catch (err) {
            alert('Error de conexión. Intenta de nuevo.');
        } finally {
            setUpgrading(null);
        }
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
        const pwResult = validatePassword(contrasenaNueva);
        if (!pwResult.valid) {
            setPasswordErr(pwResult.errors[0]);
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
    const esPro = usuario?.plan_actual === 'Pro';
    const esEmpresa = usuario?.plan_actual === 'Empresa';
    const esPago = esPro || esEmpresa;

    const contratosPercent = esGratuito ? Math.min((contratosUsados / 15) * 100, 100) : 0;
    const plantillasPercent = esGratuito ? Math.min((plantillasCreadas / 2) * 100, 100) : 0;

    const formatDate = (dateStr) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleDateString('es-ES', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    };

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
                    <span className={`plan-badge-large ${esPago ? 'plan-paid' : ''}`}>
                        {usuario?.plan_actual}
                    </span>
                </div>

                {/* Plan activo info */}
                {esPago && (
                    <div className="plan-active-info">
                        <div className="plan-status-row">
                            <span>Estado</span>
                            <span className={`status-tag ${usuario?.plan_estado}`}>
                                {usuario?.plan_estado === 'activo' ? '✅ Activo' :
                                    usuario?.plan_estado === 'cancelado' ? '❌ Cancelado' :
                                        usuario?.plan_estado === 'suspendido' ? '⚠️ Suspendido' : '⏳ Pendiente'}
                            </span>
                        </div>
                        {usuario?.plan_vencimiento && (
                            <div className="plan-status-row">
                                <span>Próximo cobro</span>
                                <span>{formatDate(usuario.plan_vencimiento)}</span>
                            </div>
                        )}
                        <div className="plan-benefits-active">
                            ✨ Plantillas y contratos ilimitados • Marca blanca
                            {esEmpresa && ' • 5 técnicos'}
                        </div>
                    </div>
                )}

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
                                <span>{plantillasCreadas}/2</span>
                            </div>
                            <div className="progress-bar">
                                <div
                                    className={`progress-fill ${plantillasPercent >= 100 ? 'danger' : ''}`}
                                    style={{ width: `${plantillasPercent}%` }}
                                />
                            </div>
                        </div>

                        {/* Plan cards */}
                        <div className="plan-cards">
                            <div className="plan-card pro">
                                <div className="plan-card-header">
                                    <span className="plan-card-name">Pro</span>
                                    <span className="plan-card-price">$8.000<small>/mes</small></span>
                                </div>
                                <ul className="plan-card-features">
                                    <li>✓ Contratos ilimitados</li>
                                    <li>✓ Plantillas ilimitadas</li>
                                    <li>✓ Marca blanca en PDFs</li>
                                    <li>✓ Soporte prioritario</li>
                                </ul>
                                <button
                                    className="upgrade-btn"
                                    onClick={() => handleUpgrade('pro')}
                                    disabled={upgrading !== null}
                                >
                                    {upgrading === 'pro' ? 'Redirigiendo...' : '🚀 Pasarse a Pro'}
                                </button>
                            </div>

                            <div className="plan-card empresa">
                                <div className="plan-card-header">
                                    <span className="plan-card-name">Empresa</span>
                                    <span className="plan-card-price">$25.000<small>/mes</small></span>
                                </div>
                                <ul className="plan-card-features">
                                    <li>✓ Todo lo de Pro</li>
                                    <li>✓ 5 técnicos incluidos</li>
                                    <li>✓ Panel de administración</li>
                                    <li>✓ Reportes avanzados</li>
                                </ul>
                                <button
                                    className="upgrade-btn empresa-btn"
                                    onClick={() => handleUpgrade('empresa')}
                                    disabled={upgrading !== null}
                                >
                                    {upgrading === 'empresa' ? 'Redirigiendo...' : '🏢 Plan Empresa'}
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* Upgrade from Pro to Empresa */}
                {esPro && (
                    <div className="plan-cards" style={{ marginTop: '16px' }}>
                        <div className="plan-card empresa">
                            <div className="plan-card-header">
                                <span className="plan-card-name">Empresa</span>
                                <span className="plan-card-price">$25.000<small>/mes</small></span>
                            </div>
                            <ul className="plan-card-features">
                                <li>✓ Todo lo de Pro</li>
                                <li>✓ 5 técnicos incluidos</li>
                                <li>✓ Panel de administración</li>
                            </ul>
                            <button
                                className="upgrade-btn empresa-btn"
                                onClick={() => handleUpgrade('empresa')}
                                disabled={upgrading !== null}
                            >
                                {upgrading === 'empresa' ? 'Redirigiendo...' : '⬆️ Subir a Empresa'}
                            </button>
                        </div>
                    </div>
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
