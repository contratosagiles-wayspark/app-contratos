import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../styles/components/_pages.scss';

function TemplatePage() {
    const navigate = useNavigate();
    const { idPlantilla } = useParams();
    const isEditing = !!idPlantilla;

    const [nombre, setNombre] = useState('');
    const [bloques, setBloques] = useState([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Branding state
    const [marcaAgua, setMarcaAgua] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [logoPosicion, setLogoPosicion] = useState('centro');
    const [footerTexto, setFooterTexto] = useState('');
    const [logoPreview, setLogoPreview] = useState(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [brandingError, setBrandingError] = useState('');

    // User plan
    const [plan, setPlan] = useState(null);

    useEffect(() => {
        cargarUsuario();
    }, []);

    useEffect(() => {
        if (isEditing) {
            cargarPlantilla();
        } else {
            setLoading(false);
        }
    }, [idPlantilla]);

    const cargarUsuario = async () => {
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setPlan(data.usuario.plan_actual);
            }
        } catch (err) {
            // silently fail — plan defaults to null (no branding shown)
        }
    };

    const cargarPlantilla = async () => {
        try {
            const res = await fetch(`/api/plantillas/${idPlantilla}`, { credentials: 'include' });
            if (!res.ok) {
                setError('Plantilla no encontrada.');
                setLoading(false);
                return;
            }
            const data = await res.json();
            const plantilla = data.plantilla;
            setNombre(plantilla.nombre_plantilla || '');

            const bloquesData = typeof plantilla.estructura_bloques === 'string'
                ? JSON.parse(plantilla.estructura_bloques)
                : (plantilla.estructura_bloques || []);

            // Assign IDs to loaded blocks for React keys
            setBloques(bloquesData.map((b, i) => ({ ...b, id: Date.now() + i })));

            // Load branding fields
            setMarcaAgua(plantilla.marca_agua || '');
            setLogoUrl(plantilla.logo_url || '');
            setLogoPosicion(plantilla.logo_posicion || 'centro');
            setFooterTexto(plantilla.footer_texto || '');
            if (plantilla.logo_url) {
                setLogoPreview('/' + plantilla.logo_url);
            }
        } catch (err) {
            setError('Error de conexión.');
        } finally {
            setLoading(false);
        }
    };

    const agregarBloque = (tipo) => {
        const nuevoBloque = {
            id: Date.now(),
            tipo,
            contenido: '',
            variable: '',
            etiqueta: '',
        };
        setBloques([...bloques, nuevoBloque]);
    };

    const actualizarBloque = (id, campo, valor) => {
        setBloques(bloques.map((b) => (b.id === id ? { ...b, [campo]: valor } : b)));
    };

    const eliminarBloque = (id) => {
        setBloques(bloques.filter((b) => b.id !== id));
    };

    const moverBloque = (index, direction) => {
        const newBloques = [...bloques];
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= newBloques.length) return;
        [newBloques[index], newBloques[newIndex]] = [newBloques[newIndex], newBloques[index]];
        setBloques(newBloques);
    };

    // ── Logo upload handler ──
    const handleLogoChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setBrandingError('');

        // Client-side validation
        const allowedTypes = ['image/png', 'image/jpeg'];
        if (!allowedTypes.includes(file.type)) {
            setBrandingError('Solo se permiten archivos PNG o JPG.');
            e.target.value = '';
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setBrandingError('El archivo no puede superar 2MB.');
            e.target.value = '';
            return;
        }

        // Generate local preview
        const reader = new FileReader();
        reader.onload = (ev) => setLogoPreview(ev.target.result);
        reader.readAsDataURL(file);

        // Upload to server
        setUploadingLogo(true);
        try {
            const formData = new FormData();
            formData.append('logo', file);

            const res = await fetch('/api/plantillas/upload-logo', {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                setBrandingError(data.mensaje || 'Error al subir el logo.');
                setLogoPreview(null);
                return;
            }

            setLogoUrl(data.logo_url);
        } catch (err) {
            setBrandingError('Error de conexión al subir el logo.');
            setLogoPreview(null);
        } finally {
            setUploadingLogo(false);
        }
    };

    const guardar = async () => {
        if (!nombre.trim()) {
            setError('El nombre de la plantilla es obligatorio.');
            return;
        }
        if (bloques.length === 0) {
            setError('Agrega al menos un bloque.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const url = isEditing
                ? `/api/plantillas/${idPlantilla}`
                : '/api/plantillas';
            const method = isEditing ? 'PUT' : 'POST';

            // Auto-generar y limpiar nombres de variables
            const sanitizedBloques = bloques.map(({ id, ...rest }, index) => {
                const isEstatico = rest.tipo === 'texto_estatico';
                let varName = rest.variable ? rest.variable.trim() : '';

                if (!varName && !isEstatico) {
                    varName = rest.etiqueta || `var_bloque_${index}`;
                }

                if (varName) {
                    rest.variable = varName
                        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                        .replace(/[^a-zA-Z0-9_]/g, '_')
                        .replace(/_+/g, '_')
                        .toLowerCase()
                        .replace(/^_|_$/g, ''); // remove leading/trailing underscores
                    
                    if (!rest.variable) rest.variable = `var_${index}`;
                } else {
                    delete rest.variable;
                }

                return rest;
            });

            const body = {
                nombre_plantilla: nombre,
                estructura_bloques: sanitizedBloques,
            };

            // Include branding fields only for premium users
            const esPremium = plan === 'Pro' || plan === 'Empresa';
            if (esPremium) {
                body.marca_agua = marcaAgua || null;
                body.logo_url = logoUrl || null;
                body.logo_posicion = logoPosicion || null;
                body.footer_texto = footerTexto || null;
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) {
                let errorMsg = data.error || 'Error al guardar.';
                if (data.detalles && data.detalles.length > 0) {
                    errorMsg += " " + data.detalles.map(d => `${d.campo.replace('estructura_bloques.', 'Bloque ')}: ${d.mensaje}`).join(', ');
                }
                setError(errorMsg);
                return;
            }

            navigate('/home');
        } catch (err) {
            setError('Error de conexión.');
        } finally {
            setSaving(false);
        }
    };

    const tipoLabels = {
        texto_estatico: '📝 Texto Estático',
        texto_dinamico: '✏️ Texto Dinámico',
        valores_dinamicos: '🔢 Valores Dinámicos',
        imagen: '🖼️ Imagen',
    };

    const esPremium = plan === 'Pro' || plan === 'Empresa';

    if (loading) {
        return (
            <div className="template-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div className="spinner" style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#16A34A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
        );
    }

    return (
        <div className="template-page">
            <div className="page-header">
                <button className="back-btn" onClick={() => navigate('/home')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <h1>{isEditing ? 'Editar Plantilla' : 'Nueva Plantilla'}</h1>
                <button className="save-btn" onClick={guardar} disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar'}
                </button>
            </div>

            <input
                className="template-name-input"
                type="text"
                placeholder="Nombre de la plantilla..."
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
            />

            {error && <p style={{ color: '#E53E3E', fontSize: '14px', marginBottom: '16px' }}>{error}</p>}

            {/* Bloques */}
            <div className="blocks-section">
                <div className="section-label">Bloques de contenido ({bloques.length})</div>

                {bloques.map((bloque, index) => (
                    <div className="block-item" key={bloque.id}>
                        <div className="block-header">
                            <span className={`block-type-badge ${bloque.tipo}`}>
                                {tipoLabels[bloque.tipo]}
                            </span>
                            <div className="block-actions">
                                <button onClick={() => moverBloque(index, -1)} title="Subir">↑</button>
                                <button onClick={() => moverBloque(index, 1)} title="Bajar">↓</button>
                                <button className="delete-btn" onClick={() => eliminarBloque(bloque.id)} title="Eliminar">×</button>
                            </div>
                        </div>

                        <div className="block-fields">
                            {bloque.tipo === 'texto_estatico' && (
                                <>
                                    <label>Contenido del texto</label>
                                    <textarea
                                        placeholder="Escribe el texto fijo del contrato..."
                                        value={bloque.contenido}
                                        onChange={(e) => actualizarBloque(bloque.id, 'contenido', e.target.value)}
                                    />
                                </>
                            )}

                            {bloque.tipo === 'texto_dinamico' && (
                                <>
                                    <label>Nombre de la variable</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: nombre_cliente"
                                        value={bloque.variable}
                                        onChange={(e) => actualizarBloque(bloque.id, 'variable', e.target.value)}
                                    />
                                    <label>Etiqueta visible</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Nombre del cliente"
                                        value={bloque.etiqueta}
                                        onChange={(e) => actualizarBloque(bloque.id, 'etiqueta', e.target.value)}
                                    />
                                </>
                            )}

                            {bloque.tipo === 'valores_dinamicos' && (
                                <>
                                    <label>Nombre de la variable</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: monto_total"
                                        value={bloque.variable}
                                        onChange={(e) => actualizarBloque(bloque.id, 'variable', e.target.value)}
                                    />
                                    <label>Etiqueta visible</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Monto total del servicio"
                                        value={bloque.etiqueta}
                                        onChange={(e) => actualizarBloque(bloque.id, 'etiqueta', e.target.value)}
                                    />
                                </>
                            )}

                            {bloque.tipo === 'imagen' && (
                                <>
                                    <label>Etiqueta del campo de imagen</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Logo de la empresa"
                                        value={bloque.etiqueta}
                                        onChange={(e) => actualizarBloque(bloque.id, 'etiqueta', e.target.value)}
                                    />
                                    <label>Nombre de la variable</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: logo_empresa"
                                        value={bloque.variable}
                                        onChange={(e) => actualizarBloque(bloque.id, 'variable', e.target.value)}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Block Buttons */}
            <div className="add-block-grid">
                <button className="add-block-btn" onClick={() => agregarBloque('texto_estatico')}>
                    <span className="block-icon">📝</span>
                    Texto Estático
                </button>
                <button className="add-block-btn" onClick={() => agregarBloque('texto_dinamico')}>
                    <span className="block-icon">✏️</span>
                    Texto Dinámico
                </button>
                <button className="add-block-btn" onClick={() => agregarBloque('valores_dinamicos')}>
                    <span className="block-icon">🔢</span>
                    Valores Dinámicos
                </button>
                <button className="add-block-btn" onClick={() => agregarBloque('imagen')}>
                    <span className="block-icon">🖼️</span>
                    Imagen
                </button>
            </div>

            {/* ── Branding Section (Solo Pro y Empresa) ── */}
            {esPremium && (
                <div className="branding-section">
                    <div className="branding-section-header">
                        <span className="branding-icon">🎨</span>
                        <h2>Personalización de marca</h2>
                    </div>

                    {brandingError && (
                        <p className="branding-error">{brandingError}</p>
                    )}

                    {/* Logo upload */}
                    <div className="branding-field">
                        <label htmlFor="branding-logo-input">Logo de la empresa (PNG o JPG, máx. 2MB)</label>
                        <input
                            id="branding-logo-input"
                            type="file"
                            accept="image/png,image/jpeg"
                            onChange={handleLogoChange}
                            className="branding-file-input"
                        />
                        {uploadingLogo && <span className="branding-uploading">Subiendo logo...</span>}
                    </div>

                    {/* Logo preview */}
                    {logoPreview && (
                        <div className="branding-logo-preview">
                            <img src={logoPreview} alt="Preview del logo" />
                        </div>
                    )}

                    {/* Logo position */}
                    <div className="branding-field">
                        <label>Posición del logo</label>
                        <div className="branding-position-group">
                            {['izquierda', 'centro', 'derecha'].map((pos) => (
                                <button
                                    key={pos}
                                    type="button"
                                    className={`branding-pos-btn ${logoPosicion === pos ? 'active' : ''}`}
                                    onClick={() => setLogoPosicion(pos)}
                                >
                                    {pos === 'izquierda' && '⬅️ Izquierda'}
                                    {pos === 'centro' && '↔️ Centro'}
                                    {pos === 'derecha' && '➡️ Derecha'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Marca de agua */}
                    <div className="branding-field">
                        <label htmlFor="branding-watermark">Texto de marca de agua (opcional)</label>
                        <input
                            id="branding-watermark"
                            type="text"
                            placeholder="Ej: CONFIDENCIAL"
                            value={marcaAgua}
                            onChange={(e) => setMarcaAgua(e.target.value)}
                            maxLength={255}
                        />
                    </div>

                    {/* Footer */}
                    <div className="branding-field">
                        <label htmlFor="branding-footer">Pie de página (opcional)</label>
                        <textarea
                            id="branding-footer"
                            placeholder="Ej: Documento generado por App Contratos"
                            value={footerTexto}
                            onChange={(e) => setFooterTexto(e.target.value)}
                            rows={2}
                            maxLength={2000}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default TemplatePage;
