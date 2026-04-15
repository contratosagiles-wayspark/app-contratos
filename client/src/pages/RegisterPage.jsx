import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { validatePassword } from '../utils/passwordValidation';
import '../styles/components/_login.scss';

function RegisterPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    // Estado compartido
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Estado flujo normal
    const [email, setEmail] = useState('');
    const [contrasena, setContrasena] = useState('');
    const [confirmar, setConfirmar] = useState('');
    const [esperandoVerificacion, setEsperandoVerificacion] = useState(false);
    const [codigoInput, setCodigoInput] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Estado flujo invitación
    const [invitacion, setInvitacion] = useState(null); // { email, nombre_tenant }
    const [loadingInvitacion, setLoadingInvitacion] = useState(false);
    const [nombre, setNombre] = useState('');
    const [contrasenaInv, setContrasenaInv] = useState('');
    const [confirmarInv, setConfirmarInv] = useState('');

    useEffect(() => {
        if (token) {
            cargarInvitacion();
        }
    }, [token]);

    const cargarInvitacion = async () => {
        setLoadingInvitacion(true);
        try {
            const res = await fetch(`/api/auth/invitacion/${token}`, {
                credentials: 'include'
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'La invitación es inválida o ya expiró.');
                return;
            }
            setInvitacion(data);
        } catch (err) {
            setError('Error de conexión. Intentá de nuevo.');
        } finally {
            setLoadingInvitacion(false);
        }
    };

    // ── Flujo normal ─────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (contrasena !== confirmar) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        const pwResult = validatePassword(contrasena);
        if (!pwResult.valid) {
            setError(pwResult.errors[0]);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, contrasena }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Error al registrar usuario.');
                return;
            }
            setEsperandoVerificacion(true);
        } catch (err) {
            setError('Error de conexión. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerificar = async () => {
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/auth/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code: codigoInput }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Error al verificar el código.');
                return;
            }
            setSuccessMessage(data.message);
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setError('Error de conexión. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    // ── Flujo invitación ──────────────────────────────────────
    const handleSubmitInvitacion = async (e) => {
        e.preventDefault();
        setError('');
        if (!nombre.trim()) {
            setError('El nombre es requerido.');
            return;
        }
        if (contrasenaInv !== confirmarInv) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        const pwResult = validatePassword(contrasenaInv);
        if (!pwResult.valid) {
            setError(pwResult.errors[0]);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/auth/aceptar-invitacion/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: nombre.trim(), password: contrasenaInv }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Error al procesar la invitación.');
                return;
            }
            setSuccessMessage('¡Cuenta creada! Redirigiendo al login...');
            setTimeout(() => navigate('/login'), 1500);
        } catch (err) {
            setError('Error de conexión. Intentá de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    // ── Render flujo invitación ───────────────────────────────
    if (token) {
        if (loadingInvitacion) {
            return (
                <div className="register-page">
                    <div className="login-card">
                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                            Validando invitación...
                        </p>
                    </div>
                </div>
            );
        }

        if (error && !invitacion) {
            return (
                <div className="register-page">
                    <div className="login-card">
                        <div className="login-header">
                            <h1>Invitación inválida</h1>
                        </div>
                        <div className="error-message">{error}</div>
                        <div className="login-footer">
                            <Link to="/login">Ir al login</Link>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="register-page">
                <div className="login-card">
                    <div className="login-header">
                        <div className="login-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </div>
                        <h1>Unirte a {invitacion?.nombre_tenant}</h1>
                        <p>Fuiste invitado a unirte al equipo. Completá tu perfil para continuar.</p>
                    </div>

                    {successMessage && <div className="success-message">{successMessage}</div>}
                    {error && <div className="error-message">{error}</div>}

                    <form onSubmit={handleSubmitInvitacion}>
                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                value={invitacion?.email || ''}
                                disabled
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="inv-nombre">Tu nombre</label>
                            <input
                                id="inv-nombre"
                                type="text"
                                placeholder="Nombre completo"
                                value={nombre}
                                onChange={e => setNombre(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="inv-contrasena">Contraseña</label>
                            <input
                                id="inv-contrasena"
                                type="password"
                                placeholder="Mínimo 8 caracteres"
                                value={contrasenaInv}
                                onChange={e => setContrasenaInv(e.target.value)}
                                required
                                autoComplete="new-password"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="inv-confirmar">Confirmá la contraseña</label>
                            <input
                                id="inv-confirmar"
                                type="password"
                                placeholder="Repetí tu contraseña"
                                value={confirmarInv}
                                onChange={e => setConfirmarInv(e.target.value)}
                                required
                                autoComplete="new-password"
                            />
                        </div>
                        <button
                            className="btn-primary"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? 'Procesando...' : 'Crear cuenta y unirme'}
                        </button>
                    </form>
                    <div className="login-footer">
                        <div className="legal-links">
                            <Link to="/terminos">Términos</Link>
                            {' · '}
                            <Link to="/privacidad">Privacidad</Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Render flujo normal: verificación de email ────────────
    if (esperandoVerificacion) {
        return (
            <div className="register-page">
                <div className="back-to-landing">
                    <Link to="/">← Volver al inicio</Link>
                </div>
                <div className="login-card">
                    <div className="login-header">
                        <div className="login-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        </div>
                        <h1>Revisá tu email</h1>
                        <p>Ingresá el código de 6 dígitos que enviamos a <strong>{email}</strong></p>
                    </div>

                    {error && <div className="error-message">{error}</div>}
                    {successMessage && <div className="success-message">{successMessage}</div>}

                    {!successMessage && (
                        <>
                            <div className="form-group">
                                <label htmlFor="verify-code">Código de verificación</label>
                                <input
                                    id="verify-code"
                                    type="text"
                                    placeholder="123456"
                                    value={codigoInput}
                                    onChange={e => setCodigoInput(e.target.value)}
                                    maxLength={6}
                                    autoComplete="one-time-code"
                                />
                            </div>
                            <button
                                type="button"
                                className="btn-primary"
                                disabled={loading || codigoInput.length !== 6}
                                onClick={handleVerificar}
                            >
                                {loading ? 'Verificando...' : 'Verificar Email'}
                            </button>
                        </>
                    )}

                    <div className="login-footer">
                        <Link to="/login">Volver al inicio de sesión</Link>
                        <div className="legal-links">
                            <Link to="/terminos">Términos</Link>
                            {' · '}
                            <Link to="/privacidad">Privacidad</Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Render flujo normal: registro ─────────────────────────
    return (
        <div className="register-page">
            <div className="back-to-landing">
                <Link to="/">← Volver al inicio</Link>
            </div>
            <div className="login-card">
                <div className="login-header">
                    <div className="login-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="8.5" cy="7" r="4" />
                            <line x1="20" y1="8" x2="20" y2="14" />
                            <line x1="23" y1="11" x2="17" y2="11" />
                        </svg>
                    </div>
                    <h1>Crear Cuenta</h1>
                    <p>Regístrate para comenzar</p>
                </div>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="reg-email">Correo electrónico</label>
                        <input
                            id="reg-email"
                            type="email"
                            placeholder="tu@email.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="reg-contrasena">Contraseña</label>
                        <input
                            id="reg-contrasena"
                            type="password"
                            placeholder="Mínimo 6 caracteres"
                            value={contrasena}
                            onChange={e => setContrasena(e.target.value)}
                            required
                            autoComplete="new-password"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="reg-confirmar">Confirmar Contraseña</label>
                        <input
                            id="reg-confirmar"
                            type="password"
                            placeholder="Repite la contraseña"
                            value={confirmar}
                            onChange={e => setConfirmar(e.target.value)}
                            required
                            autoComplete="new-password"
                        />
                    </div>
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={loading}
                    >
                        {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                    </button>
                </form>

                <div className="login-footer">
                    ¿Ya tienes cuenta?
                    <Link to="/login">Inicia sesión</Link>
                    <div className="legal-links">
                        <Link to="/terminos">Términos</Link>
                        {' · '}
                        <Link to="/privacidad">Privacidad</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RegisterPage;
