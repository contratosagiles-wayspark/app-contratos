import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../styles/components/_pages.scss';

function ContractFormPage() {
    const { idPlantilla } = useParams();
    const navigate = useNavigate();
    const [plantilla, setPlantilla] = useState(null);
    const [titulo, setTitulo] = useState('');
    const [datos, setDatos] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        cargarPlantilla();
    }, [idPlantilla]);

    const cargarPlantilla = async () => {
        try {
            const res = await fetch(`/api/plantillas/${idPlantilla}`, { credentials: 'include' });
            if (!res.ok) {
                setError('Plantilla no encontrada.');
                setLoading(false);
                return;
            }
            const data = await res.json();
            setPlantilla(data.plantilla);

            const bloques = typeof data.plantilla.estructura_bloques === 'string'
                ? JSON.parse(data.plantilla.estructura_bloques)
                : (data.plantilla.estructura_bloques || []);

            // Pre-populate datos keys
            const initial = {};
            bloques.forEach((b) => {
                if (b.variable) initial[b.variable] = '';
            });
            setDatos(initial);
            setTitulo(`Contrato - ${data.plantilla.nombre_plantilla}`);
        } catch (err) {
            setError('Error de conexión.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (variable, valor) => {
        setDatos({ ...datos, [variable]: valor });
    };

    const handleImageChange = async (variable, file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setDatos({ ...datos, [variable]: reader.result });
        };
        reader.readAsDataURL(file);
    };

    const guardar = async () => {
        if (!titulo.trim()) {
            setError('El título es obligatorio.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const res = await fetch('/api/contratos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    id_plantilla: idPlantilla,
                    titulo_contrato: titulo,
                    datos_ingresados: datos,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Error al crear contrato.');
                return;
            }

            navigate('/home');
        } catch (err) {
            setError('Error de conexión.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="contract-form-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div className="spinner" style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#16A34A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
        );
    }

    const bloques = plantilla
        ? (typeof plantilla.estructura_bloques === 'string'
            ? JSON.parse(plantilla.estructura_bloques)
            : (plantilla.estructura_bloques || []))
        : [];

    return (
        <div className="contract-form-page">
            <div className="page-header">
                <button className="back-btn" onClick={() => navigate('/home')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <h1>Nuevo Contrato</h1>
                <div className="spacer" />
            </div>

            <input
                className="contract-title-input"
                type="text"
                placeholder="Título del contrato..."
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
            />

            {error && <p style={{ color: '#E53E3E', fontSize: '14px', marginBottom: '16px' }}>{error}</p>}

            {bloques.map((bloque, i) => (
                <div className="form-block" key={i}>
                    {bloque.tipo === 'texto_estatico' && (
                        <>
                            <div className="block-label">📝 Texto fijo</div>
                            <div className="block-static-text">{bloque.contenido}</div>
                        </>
                    )}

                    {bloque.tipo === 'texto_dinamico' && (
                        <>
                            <div className="block-label">✏️ {bloque.etiqueta || bloque.variable}</div>
                            <input
                                type="text"
                                placeholder={`Ingrese ${bloque.etiqueta || bloque.variable}...`}
                                value={datos[bloque.variable] || ''}
                                onChange={(e) => handleChange(bloque.variable, e.target.value)}
                            />
                        </>
                    )}

                    {bloque.tipo === 'valores_dinamicos' && (
                        <>
                            <div className="block-label">🔢 {bloque.etiqueta || bloque.variable}</div>
                            <input
                                type="text"
                                placeholder={`Ingrese ${bloque.etiqueta || bloque.variable}...`}
                                value={datos[bloque.variable] || ''}
                                onChange={(e) => handleChange(bloque.variable, e.target.value)}
                            />
                        </>
                    )}

                    {bloque.tipo === 'imagen' && (
                        <>
                            <div className="block-label">🖼️ {bloque.etiqueta || bloque.variable}</div>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageChange(bloque.variable, e.target.files[0])}
                            />
                            {datos[bloque.variable] && (
                                <img
                                    src={datos[bloque.variable]}
                                    alt="Preview"
                                    style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '8px' }}
                                />
                            )}
                        </>
                    )}
                </div>
            ))}

            <button className="submit-btn" onClick={guardar} disabled={saving}>
                {saving ? 'Creando contrato...' : '📄 Crear Contrato'}
            </button>
        </div>
    );
}

export default ContractFormPage;
