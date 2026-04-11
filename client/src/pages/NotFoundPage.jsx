import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/components/_not-found.scss';

export default function NotFoundPage() {
    const navigate = useNavigate();
    const [autenticado, setAutenticado] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch('/api/auth/me', { credentials: 'include' });
                if (response.ok) {
                    setAutenticado(true);
                } else {
                    setAutenticado(false);
                }
            } catch (error) {
                setAutenticado(false);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    return (
        <div className="not-found-page">
            <div className="not-found-card">
                <div className="not-found-code">404</div>
                <div className="not-found-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                        <path d="M11 8v4" />
                        <path d="M11 16h.01" />
                    </svg>
                </div>
                <h1 className="not-found-title">Página no encontrada</h1>
                <p className="not-found-description">
                    La URL que ingresaste no existe. Es posible que haya sido movida, eliminada o que hayas escrito mal la dirección.
                </p>
                <div className="not-found-url">
                    {window.location.pathname}
                </div>
                <div className="not-found-actions">
                    {loading && (
                        <div className="not-found-loading">Verificando sesión...</div>
                    )}
                    {!loading && autenticado && (
                        <button 
                            className="not-found-btn not-found-btn--primary" 
                            onClick={() => navigate('/home')}
                        >
                            ← Volver al Panel
                        </button>
                    )}
                    {!loading && !autenticado && (
                        <>
                            <button 
                                className="not-found-btn not-found-btn--primary" 
                                onClick={() => navigate('/')}
                            >
                                Ir al Login
                            </button>
                            <button 
                                className="not-found-btn not-found-btn--secondary" 
                                onClick={() => navigate(-1)}
                            >
                                ← Volver atrás
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
