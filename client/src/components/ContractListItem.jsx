function ContractListItem({ icon, iconColor = 'green', title, subtitle, status, showChevron, onClick }) {
    return (
        <div className="list-item" onClick={onClick}>
            <div className="list-item-left">
                <div className={`list-item-icon ${iconColor}`}>
                    {icon}
                </div>
                <div className="list-item-content">
                    <h4>{title}</h4>
                    <p>{subtitle}</p>
                </div>
            </div>
            <div className="list-item-right">
                {status && (
                    <span className={`status-badge ${status.toLowerCase()}`}>
                        {status}
                    </span>
                )}
                {(showChevron || !status) && (
                    <span className="chevron">›</span>
                )}
            </div>
        </div>
    );
}

export default ContractListItem;
