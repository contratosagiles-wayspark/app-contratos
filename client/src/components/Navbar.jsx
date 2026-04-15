import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TemplatePickerModal from './TemplatePickerModal';
import UpgradeModal from './UpgradeModal';
import UsageBanner from './UsageBanner';
import '../styles/components/_cards.scss';

function Navbar({ usuario }) {
    const navigate = useNavigate();
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);
    const [showUpgrade, setShowUpgrade] = useState(null); // 'contratos' | 'plantillas' | null

    const handleNuevoContrato = () => {
        // Verificar límite freemium
        if (usuario?.plan_actual === 'Gratuito' && usuario?.contratos_usados_mes >= 15) {
            setShowUpgrade('contratos');
            return;
        }
        setShowTemplatePicker(true);
    };

    const handleNuevaPlantilla = () => {
        // Verificar límite freemium
        if (usuario?.plan_actual === 'Gratuito' && usuario?.plantillas_creadas >= 2) {
            setShowUpgrade('plantillas');
            return;
        }
        navigate('/plantilla/nueva');
    };

    const handleSelectTemplate = (plantilla) => {
        setShowTemplatePicker(false);
        navigate(`/contrato/nuevo/${plantilla.id_plantilla}`);
    };

    return (
        <>
            <UsageBanner usuario={usuario} />
            <nav className="navbar">
                <button className="nav-item" onClick={handleNuevoContrato}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                    Nuevo Contrato
                </button>

                <button className="nav-item" onClick={handleNuevaPlantilla}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="12" y1="8" x2="12" y2="16" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    Nueva Plantilla
                </button>

                <button className="nav-item" onClick={() => navigate('/perfil')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                    Perfil
                </button>

                {usuario?.tenant_role === 'owner' && (
                    <button className="nav-item" onClick={() => navigate('/equipo')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        Equipo
                    </button>
                )}
                {usuario?.rol === 'admin' && (
                    <button className="nav-item nav-admin" onClick={() => navigate('/admin')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Admin
                    </button>
                )}
            </nav>

            {showTemplatePicker && (
                <TemplatePickerModal
                    onClose={() => setShowTemplatePicker(false)}
                    onSelect={handleSelectTemplate}
                />
            )}

            {showUpgrade && (
                <UpgradeModal
                    tipo={showUpgrade}
                    onClose={() => setShowUpgrade(null)}
                />
            )}
        </>
    );
}

export default Navbar;
