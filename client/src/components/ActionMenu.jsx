import { useEffect, useRef } from 'react';

function ActionMenu({ contrato, position, onClose, onAction }) {
    const menuRef = useRef(null);
    const esFirmado = contrato?.estado === 'Firmado';

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    // Posicionar menú para que no salga de la pantalla
    useEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                menuRef.current.style.left = `${window.innerWidth - rect.width - 16}px`;
            }
            if (rect.bottom > window.innerHeight) {
                menuRef.current.style.top = `${position.y - rect.height}px`;
            }
        }
    }, [position]);

    return (
        <>
            <div className="action-menu-overlay" onClick={onClose} />
            <div
                className="action-menu"
                ref={menuRef}
                style={{ top: position.y, left: position.x }}
            >
                {/* Previsualizar */}
                <button
                    className="action-menu-item"
                    onClick={() => onAction('previsualizar', contrato)}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                    Previsualizar
                </button>

                {/* Descargar */}
                <button
                    className="action-menu-item"
                    onClick={() => onAction('descargar', contrato)}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Descargar
                </button>

                {/* Firmar */}
                <button
                    className={`action-menu-item ${esFirmado ? 'disabled' : ''}`}
                    onClick={() => onAction('firmar', contrato)}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    Firmar
                </button>

                {/* Editar — se oculta si firmado */}
                {!esFirmado && (
                    <button
                        className="action-menu-item"
                        onClick={() => onAction('editar', contrato)}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Editar
                    </button>
                )}

                {/* Eliminar */}
                <button
                    className="action-menu-item destructive"
                    onClick={() => onAction('eliminar', contrato)}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Eliminar
                </button>

                {/* Cerrar */}
                <button className="action-menu-item close-item" onClick={onClose}>
                    Cerrar menú
                </button>
            </div>
        </>
    );
}

export default ActionMenu;
