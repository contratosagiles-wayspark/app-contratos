import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import imageCompression from 'browser-image-compression';
import CameraModal from '../components/CameraModal';
import '../styles/components/_pages.scss';

const COMPRESSION_OPTIONS = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
    fileType: 'image/jpeg',
};

function ContractFormPage() {
    const { idPlantilla } = useParams();
    const navigate = useNavigate();
    const [plantilla, setPlantilla] = useState(null);
    const [titulo, setTitulo] = useState('');
    const [datos, setDatos] = useState({});
    const [imageFields, setImageFields] = useState({}); // { variable: [{ id, previewUrl, s3Url, uploading, compressing, error, compressedSize, originalName }] }
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [camaraAbierta, setCamaraAbierta] = useState(null); // variable del bloque activo o null

    // Refs for hidden file inputs — keyed by variable
    const galleryRefs = useRef({});

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

            const initial = {};
            bloques.forEach((b) => {
                if (b.variable && b.tipo !== 'imagen') initial[b.variable] = '';
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
        setDatos((prev) => ({ ...prev, [variable]: valor }));
    };

    // ── Image handling ──────────────────────────────────────

    const uploadImage = async (compressedFile) => {
        const formData = new FormData();
        formData.append('image', compressedFile, `img_${Date.now()}.jpg`);

        const response = await fetch('/api/uploads/image', {
            method: 'POST',
            body: formData,
            credentials: 'include',
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || 'Error al subir la imagen.');
        }

        const { url } = await response.json();
        return url;
    };

    const updateImageInField = useCallback((variable, imageId, updates) => {
        setImageFields((prev) => ({
            ...prev,
            [variable]: (prev[variable] || []).map((img) =>
                img.id === imageId ? { ...img, ...updates } : img
            ),
        }));
    }, []);

    const handleImageSelected = async (variable, event) => {
        const files = Array.from(event.target.files);
        if (!files.length) return;

        for (const file of files) {
            const imageId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

            // Add placeholder to state
            setImageFields((prev) => ({
                ...prev,
                [variable]: [
                    ...(prev[variable] || []),
                    {
                        id: imageId,
                        previewUrl: null,
                        s3Url: null,
                        uploading: false,
                        compressing: true,
                        error: null,
                        compressedSize: 0,
                        originalName: file.name,
                        file: null, // will hold compressed file for retry
                    },
                ],
            }));

            try {
                // 1. Compress
                const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
                const previewUrl = URL.createObjectURL(compressed);

                updateImageInField(variable, imageId, {
                    previewUrl,
                    compressing: false,
                    uploading: true,
                    compressedSize: compressed.size,
                    file: compressed,
                });

                // 2. Upload
                const s3Url = await uploadImage(compressed);

                updateImageInField(variable, imageId, {
                    s3Url,
                    uploading: false,
                });
            } catch (err) {
                console.error('Error procesando imagen:', err);
                updateImageInField(variable, imageId, {
                    compressing: false,
                    uploading: false,
                    error: err.message || 'Error al procesar la imagen.',
                });
            }
        }

        // Reset input so user can select the same file again
        event.target.value = '';
    };

    const handleCameraCapture = async (variable, file) => {
        setCamaraAbierta(null); // Cerrar modal

        const imageId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        setImageFields((prev) => ({
            ...prev,
            [variable]: [
                ...(prev[variable] || []),
                {
                    id: imageId,
                    previewUrl: null,
                    s3Url: null,
                    uploading: false,
                    compressing: true,
                    error: null,
                    compressedSize: 0,
                    originalName: file.name,
                    file: null,
                },
            ],
        }));

        try {
            const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
            const previewUrl = URL.createObjectURL(compressed);

            updateImageInField(variable, imageId, {
                previewUrl,
                compressing: false,
                uploading: true,
                compressedSize: compressed.size,
                file: compressed,
            });

            const s3Url = await uploadImage(compressed);

            updateImageInField(variable, imageId, {
                s3Url,
                uploading: false,
            });
        } catch (err) {
            updateImageInField(variable, imageId, {
                compressing: false,
                uploading: false,
                error: err.message || 'Error al procesar la imagen.',
            });
        }
    };

    const retryUpload = async (variable, imageId) => {
        const images = imageFields[variable] || [];
        const img = images.find((i) => i.id === imageId);
        if (!img || !img.file) return;

        updateImageInField(variable, imageId, { uploading: true, error: null });

        try {
            const s3Url = await uploadImage(img.file);
            updateImageInField(variable, imageId, { s3Url, uploading: false });
        } catch (err) {
            updateImageInField(variable, imageId, {
                uploading: false,
                error: err.message || 'Error al subir la imagen.',
            });
        }
    };

    const removeImage = (variable, imageId) => {
        setImageFields((prev) => {
            const images = (prev[variable] || []).filter((img) => img.id !== imageId);
            // Revoke blob URL to free memory
            const removed = (prev[variable] || []).find((img) => img.id === imageId);
            if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
            return { ...prev, [variable]: images };
        });
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // ── Save ────────────────────────────────────────────────

    const guardar = async () => {
        if (!titulo.trim()) {
            setError('El título es obligatorio.');
            return;
        }

        // Check if any images are still uploading
        const allImages = Object.values(imageFields).flat();
        if (allImages.some((img) => img.uploading || img.compressing)) {
            setError('Espera a que todas las imágenes terminen de subirse.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            // Build datos with image URLs
            const datosCompletos = { ...datos };
            for (const [variable, images] of Object.entries(imageFields)) {
                const urls = images
                    .filter((img) => img.s3Url)
                    .map((img) => img.s3Url);
                if (urls.length > 0) {
                    datosCompletos[variable] = urls;
                }
            }

            const res = await fetch('/api/contratos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    id_plantilla: idPlantilla,
                    titulo_contrato: titulo,
                    datos_ingresados: datosCompletos,
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

    // ── Render ───────────────────────────────────────────────

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

                            {/* Hidden file inputs */}
                            <input
                                ref={(el) => { galleryRefs.current[bloque.variable] = el; }}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => handleImageSelected(bloque.variable, e)}
                                style={{ display: 'none' }}
                            />

                            {/* Action buttons */}
                            <div className="image-buttons">
                                <button
                                    type="button"
                                    className="image-btn camera-btn"
                                    onClick={() => setCamaraAbierta(bloque.variable)}
                                >
                                    📷 Tomar foto
                                </button>
                                <button
                                    type="button"
                                    className="image-btn gallery-btn"
                                    onClick={() => galleryRefs.current[bloque.variable]?.click()}
                                >
                                    🖼️ Subir desde galería
                                </button>
                            </div>

                            {/* Thumbnail grid */}
                            {(imageFields[bloque.variable] || []).length > 0 && (
                                <div className="image-thumbnails-grid">
                                    {(imageFields[bloque.variable] || []).map((img) => (
                                        <div className={`image-thumbnail ${img.error ? 'has-error' : ''}`} key={img.id}>
                                            {img.previewUrl ? (
                                                <img src={img.previewUrl} alt={img.originalName} />
                                            ) : (
                                                <div className="image-placeholder">
                                                    <div className="mini-spinner" />
                                                </div>
                                            )}

                                            {/* Overlay for compressing/uploading */}
                                            {(img.compressing || img.uploading) && (
                                                <div className="image-overlay">
                                                    <div className="mini-spinner" />
                                                    <span>{img.compressing ? 'Comprimiendo...' : 'Subiendo...'}</span>
                                                </div>
                                            )}

                                            {/* Error overlay */}
                                            {img.error && (
                                                <div className="image-overlay error-overlay">
                                                    <span className="error-text">Error</span>
                                                    <button
                                                        type="button"
                                                        className="image-retry-btn"
                                                        onClick={() => retryUpload(bloque.variable, img.id)}
                                                    >
                                                        🔄 Reintentar
                                                    </button>
                                                </div>
                                            )}

                                            {/* Remove button */}
                                            {!img.compressing && !img.uploading && (
                                                <button
                                                    type="button"
                                                    className="image-remove-btn"
                                                    onClick={() => removeImage(bloque.variable, img.id)}
                                                    title="Eliminar imagen"
                                                >
                                                    ✕
                                                </button>
                                            )}

                                            {/* Size label */}
                                            {img.compressedSize > 0 && !img.compressing && (
                                                <div className="image-size-label">
                                                    {formatFileSize(img.compressedSize)}
                                                </div>
                                            )}

                                            {/* Upload success check */}
                                            {img.s3Url && !img.uploading && !img.error && (
                                                <div className="image-success-badge">✓</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            ))}

            <button className="submit-btn" onClick={guardar} disabled={saving}>
                {saving ? 'Creando contrato...' : '📄 Crear Contrato'}
            </button>

            {camaraAbierta && (
                <CameraModal
                    onCapture={(file) => handleCameraCapture(camaraAbierta, file)}
                    onClose={() => setCamaraAbierta(null)}
                />
            )}
        </div>
    );
}

export default ContractFormPage;
