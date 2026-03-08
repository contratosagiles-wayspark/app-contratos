import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../styles/components/_pages.scss';

function SignaturePage() {
    const { idContrato } = useParams();
    const navigate = useNavigate();
    const canvasRef = useRef(null);
    const [contrato, setContrato] = useState(null);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [clienteNombre, setClienteNombre] = useState('');
    const [codigoPais, setCodigoPais] = useState('+54');
    const [prefijo, setPrefijo] = useState('');
    const [numero, setNumero] = useState('');
    const [hasFirma, setHasFirma] = useState(false);
    const [firmaAbierta, setFirmaAbierta] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const isDrawing = useRef(false);

    useEffect(() => {
        cargarContrato();
    }, [idContrato]);

    const cargarContrato = async () => {
        try {
            const res = await fetch(`/api/contratos/${idContrato}`, { credentials: 'include' });
            if (!res.ok) {
                setError('Contrato no encontrado.');
                setLoading(false);
                return;
            }
            const data = await res.json();
            setContrato(data.contrato);
            if (data.contrato.email_cliente) {
                setEmail(data.contrato.email_cliente);
            }
        } catch (err) {
            setError('Error de conexión.');
        } finally {
            setLoading(false);
        }
    };

    // Canvas drawing logic
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;

        const getPos = (e) => {
            const r = canvas.getBoundingClientRect();
            const touch = e.touches ? e.touches[0] : e;
            return { x: touch.clientX - r.left, y: touch.clientY - r.top };
        };

        const startDraw = (e) => {
            e.preventDefault();
            isDrawing.current = true;
            const pos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        };

        const draw = (e) => {
            e.preventDefault();
            if (!isDrawing.current) return;
            const pos = getPos(e);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            setHasFirma(true);
        };

        const endDraw = () => {
            isDrawing.current = false;
        };

        canvas.addEventListener('mousedown', startDraw);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', endDraw);
        canvas.addEventListener('mouseleave', endDraw);
        canvas.addEventListener('touchstart', startDraw, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', endDraw);

        return () => {
            canvas.removeEventListener('mousedown', startDraw);
            canvas.removeEventListener('mousemove', draw);
            canvas.removeEventListener('mouseup', endDraw);
            canvas.removeEventListener('mouseleave', endDraw);
            canvas.removeEventListener('touchstart', startDraw);
            canvas.removeEventListener('touchmove', draw);
            canvas.removeEventListener('touchend', endDraw);
        };
    }, [loading, firmaAbierta]);

    const limpiarFirma = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasFirma(false);
    };

    const emailValido = email.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const codigoPaisLimpio = codigoPais.replace(/[^\d]/g, '');
    const telefonoCompleto = `${codigoPaisLimpio}${prefijo}${numero}`;
    const telefonoTieneNumero = numero.length > 0;
    const telefonoValido = telefonoTieneNumero && codigoPaisLimpio.length > 0 && prefijo.length > 0 && numero.length >= 8;
    const telefonoIncompleto = telefonoTieneNumero && (!codigoPaisLimpio.length || !prefijo.length || numero.length < 8);
    const tieneContacto = telefonoValido || (email.trim() !== '' && emailValido);
    const puedeAceptar = hasFirma && tieneContacto && !telefonoIncompleto && !submitting;

    const handleAceptar = async () => {
        if (!puedeAceptar) return;

        setSubmitting(true);
        setError('');

        try {
            const canvas = canvasRef.current;
            const firmaBase64 = canvas.toDataURL('image/png');

            const body = {
                firma_base64: firmaBase64,
                cliente_nombre: clienteNombre || null,
                email_cliente: email.trim() || null,
            };

            // Enviar teléfono solo si es válido
            if (telefonoValido) {
                body.cliente_numero = telefonoCompleto;
            }

            const res = await fetch(`/api/contratos/${idContrato}/firmar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Error al firmar.');
                setSubmitting(false);
                return;
            }

            navigate('/home');
        } catch (err) {
            setError('Error de conexión.');
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="signature-page" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <div className="spinner" style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#16A34A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
        );
    }

    const bloques = contrato?.estructura_bloques
        ? (typeof contrato.estructura_bloques === 'string'
            ? JSON.parse(contrato.estructura_bloques)
            : contrato.estructura_bloques)
        : [];

    const datos = contrato?.datos_ingresados
        ? (typeof contrato.datos_ingresados === 'string'
            ? JSON.parse(contrato.datos_ingresados)
            : contrato.datos_ingresados)
        : {};

    return (
        <div className="signature-page">
            <div className="signature-header">
                <h2>{contrato?.titulo_contrato || 'Firma de Contrato'}</h2>
                <button className="close-btn" onClick={() => navigate('/home')}>✕</button>
            </div>

            <div className="signature-content">
                {bloques.length === 0 && (
                    <div className="contract-block">
                        <p style={{ color: '#999', fontStyle: 'italic' }}>
                            Este contrato no tiene contenido de plantilla definido.
                        </p>
                    </div>
                )}

                {bloques.map((bloque, i) => (
                    <div key={i} className={`contract-block ${bloque.tipo === 'texto_estatico' ? 'static-block' : 'dynamic-block'}`}>
                        {bloque.tipo === 'texto_estatico' && (
                            <p>{bloque.contenido}</p>
                        )}

                        {(bloque.tipo === 'texto_dinamico' || bloque.tipo === 'valores_dinamicos') && (
                            <p>
                                <strong>{bloque.etiqueta || bloque.variable}: </strong>
                                {datos[bloque.variable] || `[${bloque.variable}]`}
                            </p>
                        )}

                        {bloque.tipo === 'imagen' && datos[bloque.variable] && (
                            <div className="image-block">
                                <p><strong>{bloque.etiqueta || 'Imagen'}:</strong></p>
                                {(Array.isArray(datos[bloque.variable])
                                    ? datos[bloque.variable]
                                    : [datos[bloque.variable]]
                                ).map((imgUrl, idx) => (
                                    <img key={idx} src={imgUrl} alt={`${bloque.etiqueta || 'Imagen'} ${idx + 1}`} style={{ marginBottom: '8px' }} />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="signature-footer">
                {error && <p style={{ color: '#E53E3E', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}

                <button
                    type="button"
                    onClick={() => setFirmaAbierta(!firmaAbierta)}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 24px',
                        background: firmaAbierta ? '#f0fdf4' : '#16A34A',
                        color: firmaAbierta ? '#16A34A' : '#fff',
                        border: firmaAbierta ? '2px solid #16A34A' : '2px solid #16A34A',
                        borderRadius: '999px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 600,
                        margin: '0 auto',
                        marginBottom: firmaAbierta ? '16px' : '0',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <span>{firmaAbierta ? 'Minimizar' : 'Firmar'}</span>
                    <span style={{ fontSize: '18px', lineHeight: 1 }}>{firmaAbierta ? '−' : '+'}</span>
                </button>

                {firmaAbierta && (
                <>
                <div className="canvas-container">
                    <div className="canvas-label">
                        <span>✍️ Firma del cliente</span>
                        <button onClick={limpiarFirma}>Limpiar</button>
                    </div>
                    <canvas ref={canvasRef} />
                </div>

                <div className="email-input-group">
                    <label>👤 Nombre del cliente</label>
                    <input
                        type="text"
                        placeholder="Nombre y apellido"
                        value={clienteNombre}
                        onChange={(e) => setClienteNombre(e.target.value)}
                    />
                </div>

                <div className="email-input-group">
                    <label>📱 Teléfono del cliente</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                        <div style={{ flexShrink: 0, textAlign: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Pa&iacute;s</span>
                            <input
                                type="text"
                                placeholder="+54"
                                value={codigoPais}
                                onChange={(e) => setCodigoPais(e.target.value.replace(/[^\d+]/g, '').slice(0, 5))}
                                style={{ width: '90px', textAlign: 'center', padding: '10px 6px' }}
                            />
                        </div>
                        <div style={{ flexShrink: 0, textAlign: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Prefijo</span>
                            <input
                                type="text"
                                placeholder="11"
                                value={prefijo}
                                onChange={(e) => setPrefijo(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                style={{ width: '90px', textAlign: 'center', padding: '10px 6px' }}
                            />
                        </div>
                        <div style={{ flexShrink: 0, textAlign: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>N&uacute;mero</span>
                            <input
                                type="text"
                                placeholder="65432100"
                                value={numero}
                                onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                style={{ width: '160px', textAlign: 'center', padding: '10px 6px' }}
                            />
                        </div>
                    </div>
                    {telefonoTieneNumero && !prefijo && (
                        <span style={{ color: '#E53E3E', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            El prefijo es obligatorio
                        </span>
                    )}
                    {telefonoTieneNumero && !codigoPaisLimpio && (
                        <span style={{ color: '#E53E3E', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            El código de país es obligatorio
                        </span>
                    )}
                    {numero.length > 0 && numero.length < 8 && (
                        <span style={{ color: '#E53E3E', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            El número debe tener al menos 8 dígitos
                        </span>
                    )}
                </div>

                <div className="email-input-group">
                    <label>📧 Correo electrónico (opcional)</label>
                    <input
                        type="email"
                        placeholder="ejemplo@correo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    {email.trim() !== '' && !emailValido && (
                        <span style={{ color: '#E53E3E', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            Email inválido
                        </span>
                    )}
                </div>

                <button
                    className="accept-btn"
                    disabled={!puedeAceptar}
                    onClick={handleAceptar}
                >
                    {submitting ? 'Procesando firma...' : '✅ Aceptar y Firmar'}
                </button>
                </>
                )}
            </div>
        </div>
    );
}

export default SignaturePage;
