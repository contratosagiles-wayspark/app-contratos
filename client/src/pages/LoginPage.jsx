import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/components/_login.scss';

function LoginPage() {
    const [email, setEmail] = useState('');
    const [contrasena, setContrasena] = useState('');
    const [mostrarContrasena, setMostrarContrasena] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, contrasena }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Error al iniciar sesión.');
                return;
            }

            navigate('/home');
        } catch (err) {
            setError('Error de conexión. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setError('Por favor ingresa tu correo electrónico arriba para poder recuperar tu contraseña.');
            return;
        }
        
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            
            if (!res.ok) {
                setError(data.error || 'Error al procesar la solicitud.');
                return;
            }
            // Navigate to recover page with email in state
            navigate('/recover', { state: { email } });
        } catch (err) {
            setError('Error de conexión. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                    </div>
                    <h1>Gestión de Contratos</h1>
                    <p>Inicia sesión en tu cuenta</p>
                </div>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="email">Correo electrónico</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="tu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="contrasena">Contraseña</label>
                        <div className="password-input-wrapper">
                            <input
                                id="contrasena"
                                type={mostrarContrasena ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={contrasena}
                                onChange={(e) => setContrasena(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="toggle-password-btn"
                                onClick={() => setMostrarContrasena(prev => !prev)}
                                aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            >
                                {mostrarContrasena ? (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                )}
                            </button>
                        </div>
                        <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                            <button 
                                type="button" 
                                onClick={handleForgotPassword} 
                                style={{ background: 'none', border:'none', color: '#2b7a3b', cursor: 'pointer', padding: 0, fontSize: '0.9rem' }}
                            >
                                Olvidé mi contraseña
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={loading}
                    >
                        {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                    </button>
                </form>

                <div className="login-footer">
                    ¿No tienes cuenta?
                    <Link to="/register">Regístrate</Link>
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

export default LoginPage;
