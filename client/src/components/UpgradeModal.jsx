function UpgradeModal({ onClose, tipo = 'contratos' }) {
    const mensajes = {
        contratos: {
            titulo: '¡Límite de Contratos Alcanzado!',
            subtitulo: 'Has alcanzado el máximo de 15 contratos mensuales en el plan Gratuito.',
        },
        plantillas: {
            titulo: '¡Límite de Plantillas Alcanzado!',
            subtitulo: 'Has alcanzado el máximo de 1 plantilla en el plan Gratuito.',
        },
    };

    const msg = mensajes[tipo] || mensajes.contratos;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-icon">🚀</div>
                    <h2>{msg.titulo}</h2>
                    <p>{msg.subtitulo}</p>
                </div>

                <div className="modal-body">
                    <ul className="upgrade-features">
                        <li>Plantillas ilimitadas</li>
                        <li>Contratos ilimitados por mes</li>
                        <li>Marca blanca en PDFs y correos</li>
                        <li>Soporte prioritario</li>
                    </ul>
                </div>

                <div className="modal-actions">
                    <button className="btn-modal-primary">
                        ✨ Pasarse a Pro
                    </button>
                    <button className="btn-modal-secondary" onClick={onClose}>
                        Ahora no
                    </button>
                </div>
            </div>
        </div>
    );
}

export default UpgradeModal;
