import React, { useEffect, useState } from 'react';
import { API_BASE, AUTH_HEADER } from '../api/dashboardClient';


interface StockAlert {
  id: number;
  nom: string;
  stockActuel: number;
  seuilAlerte: number;
  magasin: string;
}

const StockNotifications: React.FC = () => {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard/notifications/stock-alerts`, { headers: AUTH_HEADER() });
      if (res.ok) {
        const data: StockAlert[] = await res.json();
        setAlerts(data);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des alertes de stock:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || alerts.length === 0) return null;

  return (
    <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 1050 }}>
      <div className={`toast show ${show ? '' : 'hide'}`} role="alert">
        <div className="toast-header bg-danger text-white">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          <strong className="me-auto">Alerte Stock</strong>
          <button
            type="button"
            className="btn-close btn-close-white"
            onClick={() => setShow(false)}
          ></button>
        </div>
        <div className="toast-body">
          <div className="mb-2">
            <strong>{alerts.length} produit(s) en rupture de stock :</strong>
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {alerts.map((alert) => (
              <div key={alert.id} className="mb-2 p-2 border rounded">
                <div className="fw-bold">{alert.nom}</div>
                <small className="text-muted">
                  Stock: {alert.stockActuel} | Seuil: {alert.seuilAlerte} | {alert.magasin}
                </small>
              </div>
            ))}
          </div>
          <div className="mt-2">
            <button
              className="btn btn-sm btn-outline-primary me-2"
              onClick={() => window.location.href = '/produits'}
            >
              Gérer Stock
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setShow(false)}
            >
              Fermer
            </button>
          </div>
        </div>
      </div>

      {!show && (
        <button
          className="btn btn-danger position-relative"
          onClick={() => setShow(true)}
          title="Produits en rupture de stock"
        >
          <i className="bi bi-exclamation-triangle-fill"></i>
          <span className="badge bg-light text-danger position-absolute top-0 start-100 translate-middle">
            {alerts.length}
          </span>
        </button>
      )}
    </div>
  );
};

export default StockNotifications;