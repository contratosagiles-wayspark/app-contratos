import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { validatePassword } from '../utils/passwordValidation';
import '../styles/components/_login.scss';

function RegisterPage() {
    const [email, setEmail] = useState('');
    const [contrasena, setContrasena] = useState('');
    const [confirmar, setConfirmar] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [esperandoVerificacion, setEsperandoVerificacion] = useState(false);
    const [codigoInput, setCodigoInput] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const navigate = useNavigate();

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
            setTimeout(() => {
                navigate('/');
            }, 2000);
        } catch (err) {
            setError('Error de conexión. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    if (esperandoVerificacion) {
        return (
            <div className="register-page">
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
                                    onChange={(e) => setCodigoInput(e.target.value)}
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
                        <Link to="/">Volver al inicio de sesión</Link>
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

    return (
        <div className="register-page">
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
                            onChange={(e) => setEmail(e.target.value)}
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
                            onChange={(e) => setContrasena(e.target.value)}
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
                            onChange={(e) => setConfirmar(e.target.value)}
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
                    <Link to="/">Inicia sesión</Link>
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

