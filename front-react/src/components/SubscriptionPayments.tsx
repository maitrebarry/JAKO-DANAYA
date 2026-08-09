import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  fetchSubscriptionPlansForOwner,
  fetchMySubscriptionPayments,
  submitManualSubscriptionPayment,
  type SubscriptionPlanLiteDTO,
  type SubscriptionPaymentDTO,
} from '../api/subscription';
import { fetchCurrentSubscriptionStatus } from '../api/admin';

const SubscriptionPayments: React.FC = () => {
  const defaultManualNumbers = {
    ORANGE_MONEY: '74745669',
    WAVE: '74745669',
    MOBICASH: '67205736',
  } as const;

  const paymentStatusLabel = (s?: string | null) => {
    switch ((s || '').toUpperCase()) {
      case 'PENDING': return 'En attente de validation';
      case 'PAID': return 'Payé';
      case 'FAILED': return 'Échec';
      case 'CANCELED': return 'Annulé';
      case 'CANCELLED': return 'Annulé';
      case 'REFUNDED': return 'Remboursé';
      default: return s || '—';
    }
  };

  const subscriptionStatusLabel = (s?: string | null) => {
    switch ((s || '').toUpperCase()) {
      case 'ACTIVE': return 'Actif';
      case 'EXPIRED': return 'Expiré';
      case 'PAST_DUE': return 'Impayé';
      case 'CANCELED': return 'Annulé';
      case 'TRIAL': return 'Essai';
      default: return s || '—';
    }
  };

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlanLiteDTO[]>([]);
  const [payments, setPayments] = useState<SubscriptionPaymentDTO[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('MENSUEL');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<any>(null);
  const [manualNumbers, setManualNumbers] = useState<Record<string, string> | null>(null);
  const [modePaiement, setModePaiement] = useState<'ORANGE_MONEY' | 'WAVE' | 'MOBICASH'>('ORANGE_MONEY');
  const [transactionRef, setTransactionRef] = useState('');
  const [ownerNote, setOwnerNote] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, list, cur] = await Promise.all([
        fetchSubscriptionPlansForOwner(),
        fetchMySubscriptionPayments(),
        fetchCurrentSubscriptionStatus(),
      ]);
      // La licence achetée (ACHAT) est attribuée par le SuperAdmin uniquement : pas d'auto-achat.
      const selectablePlans = p.filter((x) => x.code !== 'ACHAT');
      setPlans(selectablePlans);
      setPayments(list);
      setCurrent(cur);
      if (selectablePlans.length > 0 && !selectablePlans.find((x) => x.code === selectedPlan)) {
        setSelectedPlan(selectablePlans[0].code);
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur chargement abonnement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pendingPayment = useMemo(() => payments.find((x) => x.statut === 'PENDING'), [payments]);

  const onInitiate = async () => {
    if (!receiptFile) {
      await Swal.fire({ icon: 'warning', title: 'Preuve requise', text: 'Veuillez joindre la photo du reçu/message de transfert.' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await submitManualSubscriptionPayment(selectedPlan, modePaiement, receiptFile, transactionRef, ownerNote);
      setManualNumbers(result?.manualPaymentNumbers || null);
      await Swal.fire({
        icon: 'success',
        title: 'Demande envoyée',
        text: `Référence: ${result?.reference || 'N/A'} (en attente de validation superadmin)`,
      });
      setTransactionRef('');
      setOwnerNote('');
      setReceiptFile(null);
      await load();
    } catch (e: any) {
      const msg = e?.message || 'Erreur initiation paiement';
      setError(msg);
      await Swal.fire({ icon: 'error', title: 'Échec', text: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-fluid">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h4 className="mb-0">Abonnement & Paiements</h4>
        <button className="btn btn-outline-primary btn-sm" onClick={load} disabled={loading || busy}>
          <i className="bi bi-arrow-clockwise me-1"></i>Rafraîchir
        </button>
      </div>

      {error && <div className="alert alert-warning">{error}</div>}

      {!current?.perpetual && (
      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-4">
              <label className="form-label">Plan</label>
              <select className="form-select" value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)} disabled={busy || loading}>
                {plans.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.libelle} ({p.duree_mois} mois) - {p.prix} {p.devise}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-8 d-flex gap-2 flex-wrap">
              <button className="btn btn-primary" onClick={onInitiate} disabled={busy || loading || plans.length === 0 || !!pendingPayment}>
                <i className="bi bi-send me-1"></i>Demander validation paiement (manuel)
              </button>
              {pendingPayment && (
                <span className="badge bg-warning text-dark d-inline-flex align-items-center px-3">
                  Une demande est en attente de validation
                </span>
              )}
            </div>
          </div>
          <div className="row g-3 mt-1">
            <div className="col-md-3">
              <label className="form-label">Canal de paiement</label>
              <select className="form-select" value={modePaiement} onChange={(e) => setModePaiement(e.target.value as any)} disabled={busy || loading || !!pendingPayment}>
                <option value="ORANGE_MONEY">Orange Money</option>
                <option value="WAVE">Wave</option>
                <option value="MOBICASH">MobiCash</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Référence transfert (optionnel)</label>
              <input
                type="text"
                className="form-control"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                disabled={busy || loading || !!pendingPayment}
                placeholder="Ex: OM123456"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Photo du reçu / message</label>
              <input
                type="file"
                className="form-control"
                accept="image/*"
                capture="environment"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                disabled={busy || loading || !!pendingPayment}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Note (optionnel)</label>
              <input
                type="text"
                className="form-control"
                value={ownerNote}
                onChange={(e) => setOwnerNote(e.target.value)}
                disabled={busy || loading || !!pendingPayment}
                placeholder="Infos utiles"
              />
            </div>
          </div>
          <small className="text-muted d-block mt-2">
            Flux manuel: vous envoyez une demande, puis le superadmin valide ou rejette.
          </small>
          <div className="alert alert-info mt-3 mb-0">
            <div className="fw-semibold mb-1">Numéros Mobile Money du service</div>
            <div>Orange Money: {(manualNumbers?.ORANGE_MONEY || (manualNumbers as any)?.ORANGE || defaultManualNumbers.ORANGE_MONEY) || '—'}</div>
            <div>Wave: {(manualNumbers?.WAVE || defaultManualNumbers.WAVE) || '—'}</div>
            <div>MobiCash: {(manualNumbers?.MOBICASH || (manualNumbers as any)?.MTN || defaultManualNumbers.MOBICASH) || '—'}</div>
          </div>
        </div>
      </div>
      )}

      <div className="card mb-3">
        <div className="card-header">État actuel</div>
        <div className="card-body">
          {current ? (
            <>
              {current.perpetual && (
                <div className="alert alert-success d-flex align-items-center mb-3" role="alert">
                  <i className="bi bi-patch-check-fill me-2" />
                  <span><strong>Licence achetée (à vie).</strong> Accès illimité — aucun renouvellement requis.</span>
                </div>
              )}
              <div className="row g-2">
                <div className="col-md-3"><strong>Boutique:</strong> {current.boutiqueNom || '—'}</div>
                <div className="col-md-3"><strong>Plan:</strong> {current.planLibelle || current.planCode || '—'}</div>
                <div className="col-md-3"><strong>Statut:</strong> {subscriptionStatusLabel(current.status)}</div>
                <div className="col-md-3"><strong>Fin:</strong> {current.perpetual ? 'Illimité' : (current.dateFin ? new Date(current.dateFin).toLocaleDateString('fr-FR') : '—')}</div>
              </div>
            </>
          ) : (
            <span className="text-muted">Aucune donnée</span>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">Historique des paiements</div>
        <div className="card-body">
          {loading ? (
            <div className="text-muted">Chargement...</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Provider</th>
                    <th>Plan</th>
                    <th>Montant</th>
                    <th>Statut</th>
                    <th>Créé le</th>
                    <th>Payé le</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.reference}</td>
                      <td>{p.provider}</td>
                      <td>{p.plan_code || '—'}</td>
                      <td>{p.montant} {p.devise}</td>
                      <td>
                        <span className={`badge ${p.statut === 'PAID' ? 'bg-success' : p.statut === 'PENDING' ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                          {paymentStatusLabel(p.statut)}
                        </span>
                      </td>
                      <td>{p.created_at ? new Date(p.created_at).toLocaleString('fr-FR') : '—'}</td>
                      <td>{p.paid_at ? new Date(p.paid_at).toLocaleString('fr-FR') : '—'}</td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-3">Aucun paiement</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPayments;
