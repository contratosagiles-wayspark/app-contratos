function StatCard({ icon, iconColor = 'green', label, value, unit }) {
    return (
        <div className="stat-card">
            <div className={`stat-icon ${iconColor}`}>
                {icon}
            </div>
            <div className="stat-label">{label}</div>
            <div className="stat-value">
                {value}
                {unit && <span className="stat-unit">{unit}</span>}
            </div>
        </div>
    );
}

export default StatCard;
