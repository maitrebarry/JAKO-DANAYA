import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useUser } from '../contexts/UserContext';

interface Vente { id: number; nomClient?: string; dateVente?: string; montantTotal?: number; }

const VentesHistorique: React.FC = () => {
  const { permissions } = useUser();
  const normalized = permissions.map(p => p.toUpperCase());
  const canRead = normalized.includes('VENTE_LECTURE');
  const canDeliver = normalized.includes('LIVRAISON_ECRITURE') || normalized.includes('VENTE_MODIFIER');

  const [ventes, setVentes] = useState<Vente[]>([]);

  useEffect(() => { if (canRead) fetchVentes(); }, [canRead]);

  const fetchVentes = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch('http://localhost:8085/api/ventes', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) throw new Error('Impossible de récupérer les ventes');
      const data = await res.json(); setVentes(data || []);
    } catch (e: any) {
      Swal.fire('Erreur', e.message || 'Erreur', 'error');
    }
  };

  if (!canRead) return <p>Vous n'avez pas la permission de voir l'historique des ventes.</p>;

  return (
    <div className="container-fluid">
      <h4>Historique des ventes</h4>
      <div className="card">
        <div className="card-body">
          {ventes.length === 0 ? <p>Aucune vente trouvée.</p> : (
            <table className="table table-striped">
              <thead>
                <tr><th>ID</th><th>Client</th><th>Date</th><th>Montant</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {ventes.map(v => (
                  <tr key={v.id}>
                    <td>{v.id}</td>
                    <td>{v.nomClient || '-'}</td>
                    <td>{v.dateVente ? new Date(v.dateVente).toLocaleString() : '-'}</td>
                    <td>{v.montantTotal != null ? v.montantTotal : '-'}</td>
                    <td>
                      <Link to={`/ventes/livraisons?venteId=${v.id}`} className={`btn btn-sm btn-outline-primary me-1 ${!canDeliver ? 'disabled' : ''}`}>Livrer</Link>
                      <Link to={`/ventes`} className="btn btn-sm btn-outline-secondary">Détails</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default VentesHistorique;
