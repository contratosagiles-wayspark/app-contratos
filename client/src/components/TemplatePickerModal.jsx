import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function TemplatePickerModal({ onClose, onSelect }) {
    const navigate = useNavigate();
    const [plantillas, setPlantillas] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPlantillas();
    }, []);

    const fetchPlantillas = async () => {
        try {
            const res = await fetch('/api/plantillas', { credentials: 'include' });
            const data = await res.json();
            setPlantillas(data.plantillas || []);
        } catch (err) {
            console.error('Error cargando plantillas:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (e, plantilla) => {
        e.stopPropagation();
        onClose();
        navigate(`/plantilla/editar/${plantilla.id_plantilla}`);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-icon">📋</div>
                    <h2>Seleccionar Plantilla</h2>
                    <p>Elige una plantilla como base para tu nuevo contrato</p>
                </div>

                <div className="modal-body">
                    {loading ? (
                        <p style={{ textAlign: 'center', color: '#999' }}>Cargando...</p>
                    ) : plantillas.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#999' }}>
                            No tienes plantillas. Crea una primero.
                        </p>
                    ) : (
                        <div className="template-list-modal">
                            {plantillas.map((p) => {
                                const bloques = typeof p.estructura_bloques === 'string'
                                    ? JSON.parse(p.estructura_bloques)
                                    : (p.estructura_bloques || []);
                                return (
                                    <div
                                        key={p.id_plantilla}
                                        className="template-option"
                                        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                                        onClick={() => onSelect(p)}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <div className="template-name">{p.nombre_plantilla}</div>
                                            <div className="template-blocks">{bloques.length} bloques</div>
                                        </div>
                                        <button
                                            className="edit-template-btn"
                                            onClick={(e) => handleEdit(e, p)}
                                            title="Editar plantilla"
                                            style={{
                                                background: 'none',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '8px',
                                                padding: '6px 10px',
                                                cursor: 'pointer',
                                                marginRight: '8px',
                                                color: '#64748b',
                                                fontSize: '14px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = '#16A34A';
                                                e.currentTarget.style.color = '#16A34A';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = '#cbd5e1';
                                                e.currentTarget.style.color = '#64748b';
                                            }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                            Editar
                                        </button>
                                        <span className="chevron">›</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="modal-actions">
                    <button className="btn-modal-secondary" onClick={onClose}>
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}

export default TemplatePickerModal;
