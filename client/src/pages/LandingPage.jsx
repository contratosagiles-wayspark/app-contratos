import { Link } from 'react-router-dom';
import { useState } from 'react';
import '../styles/components/_landing.scss';

function LandingPage() {
    const [menuAbierto, setMenuAbierto] = useState(false);

    return (
        <div className="landing-page">

            {/* ── Navbar ── */}
            <nav className="landing-nav">
                <Link to="/" className="landing-logo">
                    Contratos<span>Agiles</span>
                </Link>

                {/* Desktop: botones visibles */}
                <div className="landing-nav-actions">
                    <Link to="/login" className="btn-nav-login">Iniciar sesión</Link>
                    <Link to="/register" className="btn-nav-cta">Empezar gratis</Link>
                </div>

                {/* Mobile: botón hamburguesa */}
                <button
                    className={`hamburger-btn ${menuAbierto ? 'open' : ''}`}
                    onClick={() => setMenuAbierto((prev) => !prev)}
                    aria-label="Abrir menú"
                >
                    <span />
                    <span />
                    <span />
                </button>
            </nav>

            {/* Mobile: menú desplegable */}
            {menuAbierto && (
                <div className="mobile-menu">
                    <Link
                        to="/login"
                        className="mobile-menu-item"
                        onClick={() => setMenuAbierto(false)}
                    >
                        Iniciar sesión
                    </Link>
                    <Link
                        to="/register"
                        className="mobile-menu-item primary"
                        onClick={() => setMenuAbierto(false)}
                    >
                        Empezar gratis
                    </Link>
                </div>
            )}

            {/* ── Hero ── */}
            <section className="landing-hero">
                <div className="hero-badge">Para técnicos y profesionales</div>
                <h1>
                    Protegé tu trabajo<br />
                    <span>antes de que sea tarde</span>
                </h1>
                <p className="hero-subtitle">
                    Generá contratos con fotos en el momento, pedile la firma a tu cliente
                    en el lugar, y tenés respaldo legal si después aparecen los reclamos.
                </p>
                <div className="hero-actions">
                    <Link to="/register" className="btn-hero-primary">
                        Empezar gratis →
                    </Link>
                    <a href="#como-funciona" className="btn-hero-secondary">
                        Ver cómo funciona
                    </a>
                </div>
                <p className="hero-note">Sin tarjeta de crédito · 15 contratos gratis por mes</p>
            </section>

            {/* ── Casos de uso ── */}
            <section className="landing-cases">
                <div className="cases-header">
                    <h2>¿Para quién es ContratosAgiles?</h2>
                    <p>Para cualquier profesional que trabaja en el domicilio o local del cliente</p>
                </div>
                <div className="cases-grid">
                    <div className="case-card">
                        <span className="case-icon">📱</span>
                        <div className="case-title">Técnico de celulares</div>
                        <p className="case-description">
                            Antes de entrar a reparar el equipo, sacás fotos del estado inicial
                            y el cliente firma que así lo recibiste. Si después dice que le rayaste
                            la pantalla trasera, tenés la evidencia.
                        </p>
                        <div className="case-result">
                            <span className="case-result-icon">✓</span>
                            <span className="case-result-text">
                                Contrato con fotos firmado en 2 minutos, antes de tocar el equipo
                            </span>
                        </div>
                    </div>

                    <div className="case-card">
                        <span className="case-icon">📺</span>
                        <div className="case-title">Instalador de TV / equipos</div>
                        <p className="case-description">
                            Terminás la instalación, sacás fotos de cómo quedó todo funcionando
                            y el cliente firma la conformidad antes de irte. Si llaman a la semana
                            diciendo que algo quedó mal, tenés el contrato firmado.
                        </p>
                        <div className="case-result">
                            <span className="case-result-icon">✓</span>
                            <span className="case-result-text">
                                Acta de conformidad firmada en el momento, con evidencia fotográfica
                            </span>
                        </div>
                    </div>

                    <div className="case-card">
                        <span className="case-icon">🔧</span>
                        <div className="case-title">Plomero / electricista</div>
                        <p className="case-description">
                            Antes de empezar el trabajo explicás el presupuesto, sacás fotos
                            del problema y el cliente firma la aceptación del trabajo y el precio.
                            Si después quiere pagar menos, el acuerdo está firmado.
                        </p>
                        <div className="case-result">
                            <span className="case-result-icon">✓</span>
                            <span className="case-result-text">
                                Presupuesto aceptado por escrito antes de arrancar
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Cómo funciona ── */}
            <section className="landing-how" id="como-funciona">
                <h2>Cómo funciona</h2>
                <p className="how-subtitle">Tres pasos desde que llegás hasta que te vas</p>
                <div className="how-steps">
                    <div className="how-step">
                        <div className="step-number">1</div>
                        <div className="step-title">Creás el contrato</div>
                        <p className="step-description">
                            Usás una plantilla que armaste una vez. Completás los datos del trabajo,
                            sacás fotos del estado del equipo o del lugar, y describís lo acordado.
                        </p>
                    </div>
                    <div className="how-step">
                        <div className="step-number">2</div>
                        <div className="step-title">El cliente firma</div>
                        <p className="step-description">
                            Le mostrás el contrato en tu celular. El cliente lee, firma con el
                            dedo en pantalla y deja su email o número si quiere recibir una copia.
                        </p>
                    </div>
                    <div className="how-step">
                        <div className="step-number">3</div>
                        <div className="step-title">Ambos tienen el respaldo</div>
                        <p className="step-description">
                            Vos tenés el PDF firmado en tu cuenta. El cliente recibe una copia
                            por WhatsApp o email. Si hay un reclamo después, tenés evidencia.
                        </p>
                    </div>
                    <div className="how-step">
                        <div className="step-number">4</div>
                        <div className="step-title">Armás plantillas una vez</div>
                        <p className="step-description">
                            No empezás de cero cada vez. Creás una plantilla para tu tipo de trabajo
                            y la reutilizás con cada cliente cambiando solo los datos del momento.
                        </p>
                    </div>
                </div>
            </section>

            {/* ── Pricing ── */}
            <section className="landing-pricing">
                <div className="pricing-header">
                    <h2>Precios simples</h2>
                    <p>Empezá gratis, pagá solo cuando necesitás más</p>
                </div>
                <div className="pricing-grid">
                    <div className="pricing-card">
                        <div className="plan-name">Gratuito</div>
                        <div className="plan-price">
                            <span className="price-amount">$0</span>
                            <span className="price-period"> / mes</span>
                        </div>
                        <ul className="plan-features">
                            <li>15 contratos por mes</li>
                            <li>2 plantillas</li>
                            <li>Fotos en contratos</li>
                            <li>PDF con firma</li>
                            <li className="disabled">Contratos ilimitados</li>
                            <li className="disabled">Plantillas ilimitadas</li>
                        </ul>
                        <Link to="/register" className="plan-cta cta-secondary">
                            Empezar gratis
                        </Link>
                    </div>

                    <div className="pricing-card featured">
                        <div className="featured-badge">Más popular</div>
                        <div className="plan-name">Pro</div>
                        <div className="plan-price">
                            <span className="price-amount">$8.000</span>
                            <span className="price-period"> ARS / mes</span>
                        </div>
                        <ul className="plan-features">
                            <li>Contratos ilimitados</li>
                            <li>Plantillas ilimitadas</li>
                            <li>Fotos en contratos</li>
                            <li>PDF con firma y marca de agua</li>
                            <li>Logo de tu empresa en el PDF</li>
                            <li>Soporte prioritario</li>
                        </ul>
                        <Link to="/register" className="plan-cta cta-primary">
                            Empezar con Pro
                        </Link>
                    </div>

                    <div className="pricing-card">
                        <div className="plan-name">Empresa</div>
                        <div className="plan-price">
                            <span className="price-amount">$25.000</span>
                            <span className="price-period"> ARS / mes</span>
                        </div>
                        <ul className="plan-features">
                            <li>Todo lo de Pro</li>
                            <li>Hasta 5 técnicos</li>
                            <li>Panel de administración</li>
                            <li>Historial de actividad</li>
                            <li>Contratos ilimitados</li>
                            <li>Soporte dedicado</li>
                        </ul>
                        <Link to="/register" className="plan-cta cta-secondary">
                            Contactar
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── CTA Final ── */}
            <section className="landing-cta">
                <h2>Empezá a proteger tu trabajo hoy</h2>
                <p>
                    Creás tu cuenta en 2 minutos. No necesitás tarjeta de crédito.
                    Los primeros 15 contratos son gratis.
                </p>
                <Link to="/register" className="btn-cta-final">
                    Crear cuenta gratis →
                </Link>
            </section>

            {/* ── Footer ── */}
            <footer className="landing-footer">
                <div className="footer-links">
                    <Link to="/terminos">Términos y Condiciones</Link>
                    <Link to="/privacidad">Política de Privacidad</Link>
                    <a href="mailto:hola@contratosagiles.com">Contacto</a>
                </div>
                <p className="footer-copy">
                    © {new Date().getFullYear()} ContratosAgiles.com — Todos los derechos reservados
                </p>
            </footer>

        </div>
    );
}

export default LandingPage;
