import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { useUser } from '../contexts/UserContext';

interface Magasin { id: number; nom: string; adresse?: string }
interface TransferStock { produitId: number; nomProduit: string; quantiteDisponible: number; unite?: string; multiplicateur?: number; uniteCondLibelle?: string; prixAchat?: number; prixDetail?: number; prixGros?: number }

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
  const [transferIsCond, setTransferIsCond] = useState<Record<number, boolean>>({});
  const [transferCondQuantities, setTransferCondQuantities] = useState<Record<number, number>>({});

  const toggleTransferCond = (pid: number, checked: boolean) => {
    setTransferIsCond(prev => ({ ...prev, [pid]: checked }));
    if (checked && (transferCondQuantities[pid] === undefined)) setTransferCondQuantities(prev => ({ ...prev, [pid]: 1 }));
  };

  const setCondQty = (pid: number, qty: number) => {
    setTransferCondQuantities(prev => ({ ...prev, [pid]: qty }));
  };

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
      const mapped = (data || []).map((s: any) => ({
        produitId: s.produitId ?? s.produit?.id,
        nomProduit: s.nomProduit ?? s.produit?.nomProduit ?? s.produit?.nom ?? 'Produit',
        quantiteDisponible: s.quantiteDisponible ?? s.quantite ?? 0,
        unite: s.unite,
        multiplicateur: s.produit?.nombreUnitesParConditionnement ?? s.nombreUnitesParConditionnement ?? 1,
        uniteCondLibelle: s.produit?.unite?.libelle ?? 'carton',
        prixAchat: s.produit?.prixAchat ?? s.prixAchat ?? 0,
        prixDetail: s.produit?.prixDetail ?? s.prixDetail ?? 0,
        prixGros: s.produit?.prixEnGros ?? s.prixEnGros ?? 0
      }));
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

  const validateItems = (items: { produitId: number; quantite?: number; quantiteConditionnement?: number; }[]) => {
    if (!sourceMagasinId) { setMessage('Sélectionnez un magasin source'); return false; }
    if (!items || items.length === 0) { setMessage('Aucun produit sélectionné'); return false; }
    for (const it of items) {
      const s = transferStocks.find(ts => ts.produitId === it.produitId);
      if (!s) { setMessage('Produit introuvable dans le stock sélectionné'); return false; }

      if (it.quantiteConditionnement !== undefined && it.quantiteConditionnement !== null) {
        if (it.quantiteConditionnement <= 0) { setMessage('Quantités invalides détectées'); return false; }
        const real = (it.quantiteConditionnement || 0) * (s.multiplicateur || 1);
        if (real > (s.quantiteDisponible || 0)) { setMessage(`Quantité supérieure au disponible pour ${s.nomProduit}`); return false; }
      } else {
        if (!it.quantite || it.quantite <= 0) { setMessage('Quantités invalides détectées'); return false; }
        if (it.quantite > (s.quantiteDisponible || 0)) { setMessage(`Quantité supérieure au disponible pour ${s.nomProduit}`); return false; }
      }
    }
    if (destType === 'MAGASIN' && !destMagasinId) { setMessage('Sélectionnez un magasin destination'); return false; }
    return true;
  };

  const doTransfer = async (items: { produitId: number; quantite?: number; quantiteConditionnement?: number }[]) => {
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

  const computeEffectiveQty = (s: TransferStock) => {
    const pid = s.produitId;
    if (transferIsCond[pid]) {
      const qCond = transferCondQuantities[pid] || 0;
      return qCond * (s.multiplicateur || 1);
    }
    return transferQuantities[pid] || 0;
  };

  const formatMoney = (v?: number) => (v == null ? '0' : Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }));

  const totals = useMemo(() => {
    let tA = 0, tD = 0, tG = 0;
    for (const pid of transferSelectedIds) {
      const s = transferStocks.find(st => st.produitId === pid);
      if (!s) continue;
      const q = computeEffectiveQty(s);
      if (!q || q <= 0) continue;
      tA += q * (s.prixAchat || 0);
      tD += q * (s.prixDetail || 0);
      tG += q * (s.prixGros || 0);
    }
    return { totalAchat: tA, totalDetail: tD, totalGros: tG };
  }, [transferSelectedIds, transferQuantities, transferCondQuantities, transferIsCond, transferStocks]);

  const handleIndividualTransfer = async (produitId: number) => {
    if (transferIsCond[produitId]) {
      const qCond = transferCondQuantities[produitId] || 0;
      await doTransfer([{ produitId, quantiteConditionnement: qCond }]);
    } else {
      const qty = transferQuantities[produitId] || 0;
      await doTransfer([{ produitId, quantite: qty }]);
    }
  };

  const handleBulkTransfer = async () => {
    const items = transferSelectedIds.map(pid => (
      transferIsCond[pid] ? { produitId: pid, quantiteConditionnement: transferCondQuantities[pid] || 0 } : { produitId: pid, quantite: transferQuantities[pid] || 0 }
    ));
    await doTransfer(items);
  };

  const formatNumberCSV = (v?: number) => {
    const n = Number(v || 0);
    // Use dot decimal for CSV numbers with 2 decimals
    return n.toFixed(2);
  };

  const exportSelectedCSV = () => {
    // export selected items and totals as CSV (semicolon separated, French convention)
    const headers = ['Produit','QuantitéSaisie','QuantitéEffective','PrixAchat','MontantAchat','PrixDetail','MontantDetail','PrixGros','MontantGros'];
    const rows: string[] = [];
    rows.push(headers.join(';'));

    let tA = 0, tD = 0, tG = 0;

    for (const pid of transferSelectedIds) {
      const s = transferStocks.find(st => st.produitId === pid);
      if (!s) continue;
      const qSaisie = transferIsCond[pid] ? (transferCondQuantities[pid] || 0) : (transferQuantities[pid] || 0);
      const qEffect = computeEffectiveQty(s);
      if (!qSaisie || qSaisie <= 0) continue;
      const a = qEffect * (s.prixAchat || 0);
      const d = qEffect * (s.prixDetail || 0);
      const g = qEffect * (s.prixGros || 0);
      tA += a; tD += d; tG += g;
      const line = [
        `"${(s.nomProduit || '').replace(/"/g,'""')}"`,
        formatNumberCSV(qSaisie),
        formatNumberCSV(qEffect),
        formatNumberCSV(s.prixAchat || 0),
        formatNumberCSV(a),
        formatNumberCSV(s.prixDetail || 0),
        formatNumberCSV(d),
        formatNumberCSV(s.prixGros || 0),
        formatNumberCSV(g)
      ].join(';');
      rows.push(line);
    }

    // totals
    rows.push(['', '', 'TOTALS', '', formatNumberCSV(tA), '', formatNumberCSV(tD), '', formatNumberCSV(tG)].join(';'));

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transfert_export_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'_')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
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
                      <div className="me-3 text-end p-2 border rounded bg-light" style={{ minWidth: 'min(220px, 90vw)' }}>
                        {/* Show monetary values for currently entered quantity for this product */}
                        {(() => {
                          const qty = computeEffectiveQty(s);
                          if (!qty || qty <= 0) return <div className="small text-muted">Aucune quantité saisie</div>;
                          const a = qty * (s.prixAchat || 0);
                          const d = qty * (s.prixDetail || 0);
                          const g = qty * (s.prixGros || 0);
                          return (
                            <div className="small text-muted">
                              <div>Achat&nbsp;: <strong>{formatMoney(a)} FCFA</strong></div>
                              <div>Détail: <strong>{formatMoney(d)} FCFA</strong></div>
                              <div>Gros&nbsp;: <strong>{formatMoney(g)} FCFA</strong></div>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="me-3" style={{ width: 180 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="form-check">
                            <input className="form-check-input" type="checkbox" id={`transfer_cond_${s.produitId}`} checked={!!transferIsCond[s.produitId]} onChange={(e) => toggleTransferCond(s.produitId, e.target.checked)} />
                            <label className="form-check-label small" htmlFor={`transfer_cond_${s.produitId}`}>Par cond.</label>
                          </div>

                          {transferIsCond[s.produitId] ? (
                            <input type="number" min={0} className="form-control form-control-sm" value={transferCondQuantities[s.produitId] ?? 0} onChange={(e) => setCondQty(s.produitId, Number(e.target.value))} style={{ width: 100 }} />
                          ) : (
                            <input type="number" min={0} max={s.quantiteDisponible ?? 0} className="form-control form-control-sm" value={transferQuantities[s.produitId] ?? 0} onChange={(e) => setQty(s.produitId, Number(e.target.value))} style={{ width: 100 }} />
                          )}
                        </div>
                        <small className="text-muted">
                          {transferIsCond[s.produitId] && (transferCondQuantities[s.produitId] ?? 0) > 0 ? (() => {
                            const q = transferCondQuantities[s.produitId] || 0;
                            const mul = s.multiplicateur || 1;
                            const unitRaw = s.uniteCondLibelle || 'cond';
                            const unit = typeof unitRaw === 'string' ? unitRaw : String(unitRaw);
                            const unitPlural = (q > 1 && !unit.toLowerCase().endsWith('s')) ? `${unit}s` : unit;
                            return `${q} ${unitPlural} ≈ ${q * mul} unités`;
                          })() : ''}
                        </small>
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
                  <button className="btn btn-outline-info me-2" disabled={transferSelectedIds.length === 0} onClick={() => exportSelectedCSV()} title="Exporter les lignes sélectionnées">Exporter CSV</button>
                  <button className="btn btn-outline-secondary" onClick={() => { setTransferSelectedIds([]); setTransferQuantities({}); setTransferSelectAll(false); setMessage(''); }}>Réinitialiser</button>
                </div>
              </div>

              {message && (
                <div className="alert alert-info small">{message}</div>
              )}

              <hr />

              <div className="mb-3">
                <div><strong>Valeur estimée du transfert (sélection)</strong></div>
                <div className="mt-2 small">
                  <div>Achat total : <strong>{formatMoney(totals.totalAchat)} FCFA</strong></div>
                  <div>Prix détail total : <strong>{formatMoney(totals.totalDetail)} FCFA</strong></div>
                  <div>Prix gros total : <strong>{formatMoney(totals.totalGros)} FCFA</strong></div>
                  <div className="text-muted">(Basé sur les produits sélectionnés et quantités renseignées)</div>
                </div>
              </div>

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
