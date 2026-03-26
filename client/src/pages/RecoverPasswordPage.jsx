import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import '../styles/components/_login.scss'; // Reutilizamos estilos

function RecoverPasswordPage() {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Si no hay email en el state, forzamos volver al login
    const email = location.state?.email || '';

    const [step, setStep] = useState(1);
    
    // Step 1: Código
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    // Step 2: Nuevas Contraseñas
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    if (!email) {
        return <Navigate to="/" replace />;
    }

    const handleResendCode = async () => {
        setLoading(true);
        setError('');
        setMessage('');
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Error al reenviar el código.');
            } else {
                setMessage('Código reenviado exitosamente.');
            }
        } catch (err) {
            setError('Error de conexión.');
        } finally {
            setLoading(false);
        }
    };

    const handleValidateCode = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/validate-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code }),
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Código invalido');
                setLoading(false);
                return;
            }

            setStep(2);
            setMessage('');
            setError('');
        } catch (err) {
            setError('Error de conexión.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        
        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, newPassword }),
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Error al restablecer la contraseña.');
                return;
            }

            // Exito -> ir a login
            navigate('/', { replace: true });
        } catch (err) {
            setError('Error de conexión.');
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
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                    </div>
                    <h1>Recuperar Contraseña</h1>
                    <p>{email}</p>
                </div>

                {error && <div className="error-message" style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontWeight: 'bold' }}>{error}</div>}
                {message && <div className="success-message" style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>{message}</div>}

                {step === 1 && (
                    <form onSubmit={handleValidateCode}>
                        <p style={{ textAlign: 'center', marginBottom: '1rem', fontWeight: '500' }}>
                            Hemos enviado un código a tu correo electronico.
                        </p>
                        
                        <div className="form-group">
                            <label htmlFor="code">Código de verificación</label>
                            <input
                                id="code"
                                type="text"
                                placeholder="123456"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                required
                                maxLength="6"
                                style={{ textAlign: 'center', letterSpacing: '2px', fontSize: '1.2rem' }}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleResendCode}
                            disabled={loading}
                            style={{ background: 'none', border:'none', color: '#2b7a3b', cursor: 'pointer', padding: 0, textDecoration: 'underline', width: '100%', marginBottom: '0.5rem' }}
                        >
                            Reenviar código
                        </button>
                        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#666', marginBottom: '1.5rem' }}>
                            El mensaje puede tardar unos momentos.
                        </p>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading || code.length < 6}
                        >
                            {loading ? 'Validando...' : 'Validar'}
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleResetPassword}>
                        <div className="form-group">
                            <label htmlFor="newPassword">Nueva contraseña</label>
                            <input
                                id="newPassword"
                                type="password"
                                placeholder="••••••••"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                minLength="6"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword">Confirmación de nueva contraseña</label>
                            <input
                                id="confirmPassword"
                                type="password"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength="6"
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading || newPassword.length < 6 || confirmPassword.length < 6}
                        >
                            {loading ? 'Restableciendo...' : 'Restablecer'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

export default RecoverPasswordPage;
