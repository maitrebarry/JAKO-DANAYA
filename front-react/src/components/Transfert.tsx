import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { useUser } from '../contexts/UserContext';

interface Magasin { id: number; nom: string; adresse?: string }
interface TransferStock { produitId: number; nomProduit: string; quantiteDisponible: number; unite?: string }

const Transfert: React.FC = () => {
  const { currentBoutique, permissions } = useUser();
  const token = localStorage.getItem('smb_token');
  const normalizedPermissions = Array.isArray(permissions) ? permissions.map((p: any) => p.toUpperCase()) : [];
  const canTransfer = normalizedPermissions.includes('INVENTAIRE_MODIFIER') || normalizedPermissions.includes('INVENTAIRE_CREER');

  const [magasins, setMagasins] = useState<Magasin[]>([]);
  const [sourceMagasinId, setSourceMagasinId] = useState<number | null>(null);
  const [transferStocks, setTransferStocks] = useState<TransferStock[]>([]);
  const [transferSearch, setTransferSearch] = useState('');
  const [transferSelectedIds, setTransferSelectedIds] = useState<number[]>([]);
  const [transferSelectAll, setTransferSelectAll] = useState(false);
  const [transferQuantities, setTransferQuantities] = useState<Record<number, number>>({});

  const [destType, setDestType] = useState<'BOUTIQUE' | 'MAGASIN'>('BOUTIQUE');
  const [destMagasinId, setDestMagasinId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!currentBoutique) return;
    loadMagasins();
  }, [currentBoutique]);

  useEffect(() => {
    if (sourceMagasinId) loadStocks(sourceMagasinId);
    else setTransferStocks([]);
  }, [sourceMagasinId]);

  const loadMagasins = async () => {
    try {
      const res = await fetch('http://localhost:8085/api/magasins', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Erreur chargement magasins');
      const data = await res.json();
      setMagasins(data || []);
      if (data && data.length > 0 && !sourceMagasinId) setSourceMagasinId(data[0].id);
    } catch (err: any) {
      Swal.fire('Erreur', err.message || 'Impossible de charger les magasins', 'error');
    }
  };

  const loadStocks = async (magasinId: number) => {
    try {
      const res = await fetch(`http://localhost:8085/api/magasins/${magasinId}/stocks`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Impossible de charger les produits du magasin');
      const data = await res.json();
      // API returns items with produit info
      const mapped = (data || []).map((s: any) => ({ produitId: s.produitId ?? s.produit?.id, nomProduit: s.nomProduit ?? s.produit?.nomProduit ?? 'Produit', quantiteDisponible: s.quantiteDisponible ?? s.quantite ?? 0, unite: s.unite }));
      setTransferStocks(mapped);
      // reset selection/quantities
      setTransferSelectedIds([]);
      setTransferSelectAll(false);
      setTransferQuantities({});
    } catch (err: any) {
      Swal.fire('Erreur', err.message || 'Erreur lors du chargement des stocks', 'error');
    }
  };

  const destMagasinsOptions = useMemo(() => magasins.filter(m => m.id !== sourceMagasinId), [magasins, sourceMagasinId]);

  const toggleSelect = (pid: number) => {
    if (transferSelectedIds.includes(pid)) {
      setTransferSelectedIds(transferSelectedIds.filter(i => i !== pid));
      setTransferSelectAll(false);
    } else {
      setTransferSelectedIds([...transferSelectedIds, pid]);
    }
  };

  const toggleSelectAll = () => {
    if (transferSelectAll) {
      setTransferSelectedIds([]);
      setTransferSelectAll(false);
    } else {
      const ids = transferStocks.map(s => s.produitId).filter(Boolean);
      setTransferSelectedIds(ids);
      setTransferSelectAll(true);
    }
  };

  const setQty = (pid: number, qty: number) => {
    setTransferQuantities(prev => ({ ...prev, [pid]: qty }));
  };

  const validateItems = (items: { produitId: number; quantite: number }[]) => {
    if (!sourceMagasinId) { setMessage('Sélectionnez un magasin source'); return false; }
    if (!items || items.length === 0) { setMessage('Aucun produit sélectionné'); return false; }
    for (const it of items) {
      if (!it.quantite || it.quantite <= 0) { setMessage('Quantités invalides détectées'); return false; }
      const s = transferStocks.find(ts => ts.produitId === it.produitId);
      if (!s) { setMessage('Produit introuvable dans le stock sélectionné'); return false; }
      if (it.quantite > s.quantiteDisponible) { setMessage(`Quantité supérieure au disponible pour ${s.nomProduit}`); return false; }
    }
    if (destType === 'MAGASIN' && !destMagasinId) { setMessage('Sélectionnez un magasin destination'); return false; }
    return true;
  };

  const doTransfer = async (items: { produitId: number; quantite: number }[]) => {
    if (!validateItems(items)) return;
    setLoading(true);
    try {
      const payload = { sourceType: 'MAGASIN', sourceId: sourceMagasinId, destType: destType, destId: destType === 'BOUTIQUE' ? currentBoutique?.id : destMagasinId, items };
      const res = await fetch('http://localhost:8085/api/transferts/locations', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Erreur lors du transfert');
      }
      const data = await res.json();
      setMessage(`Transfert réussi (${data.count || items.length} lignes).`);
      loadStocks(sourceMagasinId!);
      setTimeout(() => setMessage(''), 5000);
    } catch (err: any) {
      Swal.fire('Erreur', err.message || 'Erreur lors du transfert', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleIndividualTransfer = async (produitId: number) => {
    const qty = transferQuantities[produitId] || 0;
    await doTransfer([{ produitId, quantite: qty }]);
  };

  const handleBulkTransfer = async () => {
    const items = transferSelectedIds.map(pid => ({ produitId: pid, quantite: transferQuantities[pid] || 0 }));
    await doTransfer(items);
  };

  return (
    <div className="container-fluid">
      <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Produits</div>
        <div className="breadcrumb-subtitle">Transfert</div>
      </div>

      <div className="row">
        <div className="col-lg-8">
          <div className="card">
            <div className="card-header bg-primary text-white">Magasin source et produits</div>
            <div className="card-body">
              {!canTransfer && (
                <div className="alert alert-warning">Vous n'avez pas la permission d'effectuer des transferts.</div>
              )}

              <div className="mb-3 row g-2">
                <div className="col-md-6">
                  <label className="form-label">Magasin source <span className="text-danger">*</span></label>
                  <select className="form-control" value={sourceMagasinId || ''} onChange={(e) => setSourceMagasinId(Number(e.target.value))}>
                    <option value="">Sélectionner un magasin</option>
                    {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}{m.adresse ? ` (${m.adresse})` : ''}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Rechercher</label>
                  <input className="form-control" value={transferSearch} onChange={(e) => setTransferSearch(e.target.value)} placeholder="Rechercher un produit..." />
                </div>
              </div>

              <div className="mb-2 mt-2">
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" id="transfer-select-all" checked={transferSelectAll} onChange={toggleSelectAll} />
                  <label className="form-check-label" htmlFor="transfer-select-all">Sélectionner tout (filtré)</label>
                </div>
              </div>

              <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <div className="list-group">
                  {transferStocks.filter(s => s.nomProduit.toLowerCase().includes(transferSearch.toLowerCase())).map(s => (
                    <label key={s.produitId} className="list-group-item d-flex align-items-center">
                      <input type="checkbox" className="form-check-input me-2" checked={transferSelectedIds.includes(s.produitId)} onChange={() => toggleSelect(s.produitId)} />
                      <div className="me-3 flex-grow-1">
                        <strong>{s.nomProduit}</strong> <small className="text-muted">{s.unite ? `(${s.unite})` : ''}</small>
                      </div>
                      <div className="me-3">Dispo: <span className="fw-bold">{s.quantiteDisponible ?? 0}</span></div>
                      <div className="me-3" style={{ width: 120 }}>
                        <input type="number" min={0} max={s.quantiteDisponible ?? 0} className="form-control form-control-sm" value={transferQuantities[s.produitId] ?? 0} onChange={(e) => setQty(s.produitId, Number(e.target.value))} />
                      </div>
                      <button className="btn btn-sm btn-primary" onClick={() => handleIndividualTransfer(s.produitId)}>Transférer</button>
                    </label>
                  ))}
                  {transferStocks.length === 0 && <div className="text-muted small p-3">Aucun produit trouvé pour ce magasin.</div>}
                </div>
              </div>

            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card">
            <div className="card-header bg-dark text-white">Destination</div>
            <div className="card-body">
              <div className="mb-3">
                <div className="form-check">
                  <input className="form-check-input" type="radio" id="dest_boutique" checked={destType === 'BOUTIQUE'} onChange={() => { setDestType('BOUTIQUE'); setDestMagasinId(null); }} />
                  <label className="form-check-label" htmlFor="dest_boutique">Stock boutique (par défaut)</label>
                </div>
                <div className="form-check mt-2">
                  <input className="form-check-input" type="radio" id="dest_magasin" checked={destType === 'MAGASIN'} onChange={() => setDestType('MAGASIN')} />
                  <label className="form-check-label" htmlFor="dest_magasin">Magasin</label>
                </div>
                {destType === 'MAGASIN' && (
                  <select className="form-control mt-2" value={destMagasinId || ''} onChange={(e) => setDestMagasinId(Number(e.target.value))}>
                    <option value="">Sélectionner un magasin destination</option>
                    {destMagasinsOptions.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                  </select>
                )}
              </div>

              <div className="mb-3">
                <div><strong>Actions</strong></div>
                <div className="mt-2">
                  <button className="btn btn-success me-2" disabled={transferSelectedIds.length === 0 || loading} onClick={handleBulkTransfer}>{loading ? 'Transfert...' : 'Transférer sélection'}</button>
                  <button className="btn btn-outline-secondary" onClick={() => { setTransferSelectedIds([]); setTransferQuantities({}); setTransferSelectAll(false); setMessage(''); }}>Réinitialiser</button>
                </div>
              </div>

              {message && (
                <div className="alert alert-info small">{message}</div>
              )}

              <hr />
              <div><strong>Conseils</strong></div>
              <ul>
                <li>Choisissez le magasin source puis sélectionnez les produits.</li>
                <li>Indiquez la quantité par produit ou utilisez la sélection multiple pour un traitement global.</li>
                <li>Assurez-vous des permissions et de l'affectation magasin/produit avant transfert.</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Transfert;
