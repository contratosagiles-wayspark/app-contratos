import { useNavigate } from 'react-router-dom';
import '../styles/components/_legal.scss';

function TerminosPage() {
    const navigate = useNavigate();

    return (
        <div className="legal-page">
            <div className="legal-container">
                <button className="back-btn" onClick={() => navigate(location.key !== 'default' ? -1 : '/')}>← Volver</button>
                <h1>Términos y Condiciones de Uso</h1>
                <p className="legal-date">Última actualización: {new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

                <section>
                    <h2>1. Aceptación de los términos</h2>
                    <p>Al registrarse y utilizar ContratosAgiles.com, el usuario acepta quedar vinculado por los presentes Términos y Condiciones. Si no está de acuerdo con alguno de estos términos, no debe utilizar el servicio.</p>
                </section>

                <section>
                    <h2>2. Descripción del servicio</h2>
                    <p>ContratosAgiles.com es una plataforma digital que permite a profesionales independientes y empresas crear, gestionar y obtener la aceptación digital de documentos contractuales. El servicio incluye la generación de documentos en formato PDF y el registro de la aceptación mediante firma digital en pantalla.</p>
                </section>

                <section>
                    <h2>3. Naturaleza de la firma digital</h2>
                    <p>La firma capturada a través de ContratosAgiles.com constituye una manifestación de voluntad del firmante, registrada con fecha, hora y datos de contacto proporcionados en el momento de la firma. ContratosAgiles.com no es una autoridad certificante bajo la Ley 25.506 de Firma Digital de la República Argentina. Los documentos generados tienen valor como instrumento privado conforme al Código Civil y Comercial de la Nación (arts. 287 y siguientes).</p>
                    <p>El usuario es responsable de evaluar la suficiencia legal del documento para su caso de uso específico y de consultar asesoramiento legal cuando lo considere necesario.</p>
                </section>

                <section>
                    <h2>4. Responsabilidades del usuario</h2>
                    <p>El usuario se compromete a: (a) proporcionar información veraz al registrarse; (b) utilizar el servicio únicamente para fines lícitos; (c) no cargar contenido que viole derechos de terceros; (d) mantener la confidencialidad de sus credenciales de acceso; (e) obtener el consentimiento informado de las personas cuyos datos personales incluya en los contratos.</p>
                </section>

                <section>
                    <h2>5. Planes y facturación</h2>
                    <p>ContratosAgiles.com ofrece un plan gratuito con límites de uso y planes pagos con funcionalidades extendidas. Los precios están expresados en pesos argentinos (ARS). Los pagos se procesan a través de MercadoPago. Las suscripciones se renuevan automáticamente salvo que el usuario las cancele antes del próximo período de facturación desde su perfil.</p>
                </section>

                <section>
                    <h2>6. Limitación de responsabilidad</h2>
                    <p>ContratosAgiles.com no asume responsabilidad por el contenido de los contratos creados por los usuarios, ni por las consecuencias legales derivadas de su uso. La plataforma es una herramienta tecnológica y no reemplaza el asesoramiento legal profesional.</p>
                </section>

                <section>
                    <h2>7. Modificaciones</h2>
                    <p>ContratosAgiles.com se reserva el derecho de modificar estos términos. Los cambios sustanciales se comunicarán por email con 15 días de anticipación. El uso continuado del servicio implica la aceptación de los términos modificados.</p>
                </section>

                <section>
                    <h2>8. Jurisdicción</h2>
                    <p>Ante cualquier controversia, las partes se someten a la jurisdicción de los Tribunales Ordinarios de la Ciudad Autónoma de Buenos Aires, República Argentina.</p>
                </section>
            </div>
        </div>
    );
}

export default TerminosPage;
