import { useNavigate } from 'react-router-dom';
import '../styles/components/_legal.scss';

function PrivacidadPage() {
    const navigate = useNavigate();

    return (
        <div className="legal-page">
            <div className="legal-container">
                <button className="back-btn" onClick={() => navigate(location.key !== 'default' ? -1 : '/')}>← Volver</button>
                <h1>Política de Privacidad</h1>
                <p className="legal-date">Última actualización: {new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

                <section>
                    <h2>1. Responsable del tratamiento</h2>
                    <p>ContratosAgiles.com, operado desde la República Argentina. Contacto para consultas de privacidad: <a href="mailto:privacidad@contratosagiles.com">privacidad@contratosagiles.com</a></p>
                </section>

                <section>
                    <h2>2. Datos que recopilamos</h2>
                    <p><strong>Datos del usuario registrado:</strong> correo electrónico, contraseña (almacenada con hash bcrypt salt 12), nombre y nombre de empresa (opcionales).</p>
                    <p><strong>Datos de los contratos:</strong> contenido ingresado por el usuario en sus plantillas y contratos. Datos del firmante: nombre, correo electrónico y número de teléfono proporcionados al momento de la firma.</p>
                    <p><strong>Datos técnicos:</strong> timestamps de creación y modificación de documentos.</p>
                </section>

                <section>
                    <h2>3. Finalidad del tratamiento</h2>
                    <p>Los datos se utilizan exclusivamente para: (a) proveer el servicio contratado; (b) enviar el PDF del contrato firmado al firmante cuando el usuario lo indique; (c) comunicaciones transaccionales del servicio.</p>
                </section>

                <section>
                    <h2>4. Base legal — Ley 25.326</h2>
                    <p>El tratamiento de datos personales se realiza con base en el consentimiento del titular al momento del registro y en la ejecución del contrato de servicio. Los datos de terceros firmantes son tratados bajo la responsabilidad del usuario de la plataforma, quien declara contar con base legal para ello.</p>
                </section>

                <section>
                    <h2>5. Almacenamiento y seguridad</h2>
                    <p>Los datos se almacenan en servidores con acceso restringido. Los archivos (PDF, imágenes, firmas) se almacenan en Cloudflare R2. Las contraseñas nunca se almacenan en texto plano. Las sesiones tienen una duración máxima de 24 horas con cookies httpOnly.</p>
                </section>

                <section>
                    <h2>6. Compartición con terceros</h2>
                    <p>ContratosAgiles.com no vende ni cede datos personales a terceros. Se utilizan los siguientes proveedores de infraestructura bajo acuerdos de confidencialidad: Neon (base de datos), Cloudflare R2 (almacenamiento de archivos), Resend (email transaccional), Twilio (notificaciones WhatsApp), MercadoPago (procesamiento de pagos), Sentry (monitoreo de errores), Railway y Vercel (infraestructura de hosting).</p>
                </section>

                <section>
                    <h2>7. Derechos del titular</h2>
                    <p>Conforme a la Ley 25.326, el titular tiene derecho a acceder, rectificar, actualizar y suprimir sus datos personales. Para ejercer estos derechos: <a href="mailto:privacidad@contratosagiles.com">privacidad@contratosagiles.com</a>. El organismo de control es la AAIP: <a href="https://www.argentina.gob.ar/aaip" target="_blank" rel="noopener noreferrer">www.argentina.gob.ar/aaip</a>.</p>
                </section>

                <section>
                    <h2>8. Retención de datos</h2>
                    <p>Los datos se conservan mientras la cuenta esté activa. Al elimin la cuenta, los datos se marcan como eliminados (soft delete). Los contratos firmados se retienen por 5 años por razones de valor legal potencial para las partes firmantes, salvo solicitud expresa de eliminación aceptada.</p>
                </section>
            </div>
        </div>
    );
}

export default PrivacidadPage;
