import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface CommandeData {
  id: number;
  reference: string;
  dateCommande: string;
  total: number;
  montantPaye: number;
}

const PaiementCommande: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [commande, setCommande] = useState<CommandeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [montantAPayer, setMontantAPayer] = useState<number>(0);

  const fetchCommande = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/commandes-fournisseurs/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors du chargement de la commande');
      const data = await res.json();
      const cmd: CommandeData = {
        id: data.id,
        reference: data.reference,
        dateCommande: data.dateCommande,
        total: data.total || 0,
        montantPaye: data.montantPaye || 0
      };
      setCommande(cmd);
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommande();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handlePay = async () => {
    if (!commande) return;
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/commandes-fournisseurs/${commande.id}/paiement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ montant: montantAPayer })
      });
      if (!res.ok) throw new Error('Erreur lors de l\u0027enregistrement du paiement');
      const updated = await res.json();
      setCommande({
        id: updated.id,
        reference: updated.reference,
        dateCommande: updated.dateCommande,
        total: updated.total || 0,
        montantPaye: updated.paie || updated.montantPaye || 0
      });
      setMontantAPayer(0);
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue');
    }
  };

  const montantTotal = commande?.total || 0;
  const montantPaye = commande?.montantPaye || 0;
  const montantRestant = Math.max(montantTotal - montantPaye, 0);

  if (loading) return <div>Chargement...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="card">
      <div className="card-body">
        <h5 className="card-title">Paiement de la commande {commande?.reference}</h5>
        <div className="row g-3 mb-3">
          <div className="col-md-3">
            <div className="p-3 border rounded">
              <div className="text-muted">MONTANT TOTAL / CMD</div>
              <div className="fs-5 fw-semibold">{montantTotal.toLocaleString('fr-FR')} FCFA</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="p-3 border rounded">
              <div className="text-muted">MONTANT PAYÉ</div>
              <div className="fs-5 fw-semibold">{montantPaye.toLocaleString('fr-FR')} FCFA</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="p-3 border rounded">
              <div className="text-muted">MONTANT RESTANT</div>
              <div className="fs-5 fw-semibold">{montantRestant.toLocaleString('fr-FR')} FCFA</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="p-3 border rounded">
              <div className="text-muted">MONTANT À PAYER</div>
              <input
                type="number"
                className="form-control mt-2"
                value={montantAPayer}
                min={0}
                max={montantRestant}
                onChange={(e) => setMontantAPayer(parseInt(e.target.value || '0', 10))}
              />
            </div>
          </div>
        </div>

        <div className="d-flex justify-content-end">
          <button className="btn btn-primary" onClick={handlePay} disabled={!montantAPayer || montantAPayer < 1}>
            Enregistrer le paiement
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaiementCommande;
