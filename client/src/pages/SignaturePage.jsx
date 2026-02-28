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
    const [hasFirma, setHasFirma] = useState(false);
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
    }, [loading]);

    const limpiarFirma = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasFirma(false);
    };

    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const puedeAceptar = hasFirma && emailValido && !submitting;

    const handleAceptar = async () => {
        if (!puedeAceptar) return;

        setSubmitting(true);
        setError('');

        try {
            const canvas = canvasRef.current;
            const firmaBase64 = canvas.toDataURL('image/png');

            const res = await fetch(`/api/contratos/${idContrato}/firmar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    firma_base64: firmaBase64,
                    email_cliente: email,
                }),
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
                                <img src={datos[bloque.variable]} alt={bloque.etiqueta} />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="signature-footer">
                {error && <p style={{ color: '#E53E3E', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}

                <div className="canvas-container">
                    <div className="canvas-label">
                        <span>✍️ Firma del cliente</span>
                        <button onClick={limpiarFirma}>Limpiar</button>
                    </div>
                    <canvas ref={canvasRef} />
                </div>

                <div className="email-input-group">
                    <label>📧 Correo electrónico del cliente *</label>
                    <input
                        type="email"
                        placeholder="ejemplo@correo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <button
                    className="accept-btn"
                    disabled={!puedeAceptar}
                    onClick={handleAceptar}
                >
                    {submitting ? 'Procesando firma...' : '✅ Aceptar y Firmar'}
                </button>
            </div>
        </div>
    );
}

export default SignaturePage;
