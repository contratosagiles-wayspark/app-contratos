import '../styles/components/_usage-banner.scss';

/**
 * UsageBanner – barra de uso de recursos para el plan Gratuito.
 * Muestra el consumo de contratos (límite 15/mes) y plantillas (límite 2).
 * Retorna null para cualquier plan distinto de 'Gratuito'.
 * plantillas_creadas se calcula dinámicamente en GET /me via COUNT.
 */

function getBarClass(percent) {
    if (percent >= 87) return 'usage-bar-fill--danger';
    if (percent >= 60) return 'usage-bar-fill--warn';
    return 'usage-bar-fill--ok';
}

export default function UsageBanner({ usuario }) {
    if (!usuario || usuario.plan_actual !== 'Gratuito') return null;

    const contratosUsados   = usuario.contratos_usados_mes ?? 0;
    const plantillasUsadas  = usuario.plantillas_creadas   ?? 0;

    const contratosPercent  = Math.min((contratosUsados  / 15) * 100, 100);
    const plantillasPercent = Math.min((plantillasUsadas /  2) * 100, 100);

    return (
        <div className="usage-banner">
            {/* Fila: Contratos */}
            <div className="usage-banner-row">
                <span className="usage-banner-label">
                    Contratos {contratosUsados}/15
                </span>
                <div className="usage-bar-track">
                    <div
                        className={`usage-bar-fill ${getBarClass(contratosPercent)}`}
                        style={{ width: `${contratosPercent}%` }}
                    />
                </div>
            </div>

            {/* Fila: Plantillas */}
            <div className="usage-banner-row">
                <span className="usage-banner-label">
                    Plantillas {plantillasUsadas}/2
                </span>
                <div className="usage-bar-track">
                    <div
                        className={`usage-bar-fill ${getBarClass(plantillasPercent)}`}
                        style={{ width: `${plantillasPercent}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
