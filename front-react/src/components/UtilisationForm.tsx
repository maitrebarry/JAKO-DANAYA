import React, { useEffect, useState } from 'react';
import useHasPermission from '../contexts/useHasPermission';
import SearchableSelect from './SearchableSelect';

const API_BASE = 'http://localhost:8085/api';
const AUTH_HEADER = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

interface Props {
  onSuccess?: () => void;
  onClose?: () => void;
  editing?: any;
}

const UtilisationForm: React.FC<Props> = ({ onSuccess, onClose, editing }) => {
  const canCreate = useHasPermission('UTILISA_PERTE_CREER');
  const [stocks, setStocks] = useState<any[]>([]);
  const [magasins, setMagasins] = useState<any[]>([]);
  const [produitId, setProduitId] = useState<number | ''>('');
  const [magasinId, setMagasinId] = useState<number | ''>('');
  const [quantite, setQuantite] = useState<number | ''>('');
  const [sousType, setSousType] = useState<'UTILISATION' | 'PERTE'>('UTILISATION');
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<any | null>(null);
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!canCreate) return;
    let mounted = true;

    const loadProductsForMagasin = async (mId?: number | '') => {
      try {
        if (mId) {
          const res = await fetch(`${API_BASE}/magasins/${mId}/stocks`, { headers: AUTH_HEADER() });
          if (!res.ok) throw new Error(await res.text());
          const sts = await res.json();
          if (!mounted) return;
          setStocks(sts || []);
        } else {
          const res = await fetch(`${API_BASE}/stocks`, { headers: AUTH_HEADER() });
          if (!res.ok) throw new Error(await res.text());
          const sts = await res.json();
          if (!mounted) return;
          const filtered = (sts || []).filter((s: any) => !s.magasin);
          setStocks(filtered || []);
        }
      } catch (e: any) {
        console.error(e);
        setError(String(e.message || e));
      }
    };

    const load = async () => {
      try {
        const m = await fetch(`${API_BASE}/magasins`, { headers: AUTH_HEADER() });
        if (!m.ok) throw new Error(await m.text());
        const mags = await m.json();
        if (!mounted) return;
        setMagasins(mags || []);
        // if editing, prefill values
        if (editing) {
          // handle both Mouvement and UtilisationPertes shapes
          setSousType(editing.sousType || editing.type || 'UTILISATION');
          const q = (typeof editing.quantite === 'number') ? editing.quantite : (editing.quantite ? editing.quantite : '');
          setQuantite(q as any);
          setDescription(editing.motif || editing.description || '');
          const magId = editing.magasin?.id || editing.magasinId || '';
          setMagasinId(magId);
          await loadProductsForMagasin(magId);
          // try to find a stock that matches the produit and magasin
          const prodId = editing.produit?.id || editing.produitId || editing.produitId;
          const found = (magId ? (await (async () => { const r = await fetch(`${API_BASE}/magasins/${magId}/stocks`, { headers: AUTH_HEADER() }); if (r.ok) return await r.json(); return []; })()) : (await (async () => { const r = await fetch(`${API_BASE}/stocks`, { headers: AUTH_HEADER() }); if (r.ok) return (await r.json()).filter((s: any) => !s.magasin); return []; })())).find((s: any) => (s.produit && s.produit.id === prodId) || s.produitId === prodId);
          if (found) {
            setSelectedStock(found);
            setSelectedStockId(String(found.id));
            setProduitId(found.produitId || found.produit?.id || '');
          } else {
            setProduitId(prodId || '');
          }
        } else {
          await loadProductsForMagasin(magasinId);
        }
      } catch (e: any) {
        console.error(e);
        setError(String(e.message || e));
      }
    };

    load();
    return () => { mounted = false; };
  }, [canCreate]);

  useEffect(() => {
    if (!canCreate) return;
    let mounted = true;
    const loadProductsForMagasinOnChange = async () => {
      try {
        if (magasinId) {
          const res = await fetch(`${API_BASE}/magasins/${magasinId}/stocks`, { headers: AUTH_HEADER() });
          if (!res.ok) throw new Error(await res.text());
          const sts = await res.json();
          if (!mounted) return;
          setStocks(sts || []);
        } else {
          const res = await fetch(`${API_BASE}/stocks`, { headers: AUTH_HEADER() });
          if (!res.ok) throw new Error(await res.text());
          const sts = await res.json();
          if (!mounted) return;
          const filtered = (sts || []).filter((s: any) => !s.magasin);
          setStocks(filtered || []);
        }
        // clear selected produit and stock to avoid inconsistency when magasin changes
        // but keep prefilled values when in edit mode and magasin didn't actually change from the original
        if (!editing || (editing && Number(magasinId) !== Number(editing.magasin?.id || ''))) {
          setProduitId('');
          setSelectedStock(null);
          setSelectedStockId(null);
          setQuantite('');
        }
      } catch (e: any) {
        console.error(e);
        setError(String(e.message || e));
      }
    };
    loadProductsForMagasinOnChange();
    return () => { mounted = false; };
  }, [magasinId, canCreate]);

  // Ensure that when opening in edit mode we do not immediately clear the prefilled values
  // if the magasinId matches the editing record; this prevents the quantity from being wiped.
  useEffect(() => {
    if (!editing) return;
    // If magasinId equals editing.magasin.id, do nothing; otherwise allow normal behavior
    if (magasinId && editing.magasin && Number(magasinId) === Number(editing.magasin.id)) return;
    // else keep existing behavior as user might be switching magasin while editing
  }, [editing, magasinId]);

  if (!canCreate) return null;

  const validate = () => {
    if (!produitId) return 'Produit requis';
    if (!quantite || (typeof quantite === 'number' && quantite <= 0)) return 'Quantité > 0 requise';
    if (selectedStock && (selectedStock.quantiteDisponible == null ? false : Number(quantite) > Number(selectedStock.quantiteDisponible))) return `Quantité disponible insuffisante (${selectedStock.quantiteDisponible})`;
    if (!['UTILISATION', 'PERTE'].includes(sousType)) return 'Type invalide';
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setLoading(true); setError(null); setSuccess(null);
    try {
      if (editing) {
        // If editing a UtilisationPertes entity (it has motif/type fields), update via utilisation-pertes endpoint
        const isUP = editing && (editing.motif !== undefined || editing.mouvementId !== undefined);
        if (isUP) {
          const body: any = {
            motif: description || null,
            quantite: Number(quantite),
            date: null,
            type: sousType,
            produit: produitId ? { id: produitId } : null,
            magasin: magasinId ? { id: magasinId } : null,
            boutique: null
          };
          const res = await fetch(`${API_BASE}/utilisation-pertes/${editing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...AUTH_HEADER() },
            body: JSON.stringify(body)
          });
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt || 'Erreur serveur');
          }
          await res.json();
          setSuccess('Opération modifiée');
        } else {
          // fallback to movement update
          const body: any = {
            id: editing.id,
            produit: produitId ? { id: produitId } : null,
            quantite: Number(quantite),
            sousType,
            description: description || '',
            magasin: magasinId ? { id: magasinId } : null,
            stock: selectedStockId ? { id: Number(selectedStockId) } : null
          };
          const res = await fetch(`${API_BASE}/mouvements/${editing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...AUTH_HEADER() },
            body: JSON.stringify(body)
          });
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt || 'Erreur serveur');
          }
          await res.json();
          setSuccess('Opération modifiée');
        }
      } else {
        const payload = {
          motif: description || null,
          quantite: Number(quantite),
          date: null,
          type: sousType,
          produit: produitId ? { id: produitId } : null,
          magasin: magasinId ? { id: magasinId } : null
        };
        const res = await fetch(`${API_BASE}/utilisation-pertes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...AUTH_HEADER() },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || 'Erreur serveur');
        }
        await res.json();
        setSuccess('Opération enregistrée');
      }

      if (onSuccess) onSuccess();
      // reset form
      setProduitId(''); setSelectedStockId(null); setSelectedStock(null); setMagasinId(''); setQuantite(''); setDescription(''); setSousType('UTILISATION');
    } catch (err: any) {
      console.error(err);
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex={-1} role="dialog">
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <form onSubmit={submit}>
            <div className="modal-header bg-dark text-white d-flex align-items-center justify-content-between">
              <div>
                <h5 className="modal-title d-inline">Nouvelle Utilisation / Perte</h5>
                <span className={`badge ms-2 ${sousType === 'PERTE' ? 'bg-danger' : 'bg-primary'}`}>{sousType}</span>
              </div>
              <button type="button" className="btn-close" aria-label="Close" onClick={() => onClose && onClose()} />
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}

              <div className="mb-2">
                <label className="form-label">Magasin (sélectionnez d'abord pour charger les produits, laisser vide = boutique)</label>
                <select className="form-select" value={magasinId ?? ''} onChange={e => setMagasinId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Boutique (stock global)</option>
                  {magasins.map(m => <option key={m.id} value={m.id}>{m.nom || m.nomMagasin || m.id}</option>)}
                </select>
              </div>

              <div className="mb-2">
                <label className="form-label">Produit</label>
                <SearchableSelect
                  options={stocks.map(s => {
                    const prodName = (s.produit && (s.produit.nomProduit || s.produit.nom)) || (`Stock ${s.id}`);
                    const mult = s.produit?.nombreUnitesParConditionnement || 0;
                    const unitLabel = s.produit?.unite?.libelle || 'unité';
                    const multPart = mult && mult > 1 ? ` — 1 ${unitLabel} = ${mult} unités` : '';
                    const packagingLabel = (() => {
                      const u = Number(s.quantiteDisponible || 0);
                      if (!mult || mult <= 1) return `${u} unité${u > 1 ? 's' : ''}`;
                      const full = Math.floor(u / mult);
                      const rem = u % mult;
                      if (rem === 0) return `${u} unités (${full} carton${full > 1 ? 's' : ''})`;
                      const openPart = rem > 1 ? `${rem} unités ouvertes` : `${rem} unité ouverte`;
                      const fullPart = full > 0 ? `${full} carton${full > 1 ? 's' : ''} + ` : '';
                      return `${u} unités (${fullPart}${openPart})`;
                    })();
                    const loc = s.magasin?.nom || 'Boutique';
                    return { value: String(s.id), label: `${prodName}${multPart} — ${loc} — Stock : ${packagingLabel}` };
                  })}
                  value={selectedStockId}
                  onChange={(v) => {
                    const stockId = v ? Number(v) : null;
                    if (!stockId) { setProduitId(''); setSelectedStockId(null); setSelectedStock(null); return; }
                    const s = stocks.find(st => st.id === stockId);
                    if (!s) { setProduitId(''); setSelectedStockId(null); setSelectedStock(null); return; }
                    const pid = s.produitId || s.produit?.id;
                    setProduitId(pid || '');
                    setMagasinId(s.magasin?.id || '');
                    setSelectedStockId(String(stockId));
                    setSelectedStock(s);
                  }}
                  placeholder="Rechercher un produit..."
                  allowClear
                />
              </div>

              {selectedStock && (
                <div className="mb-2">
                  <div><strong>Produit sélectionné :</strong> {selectedStock.produit?.nomProduit || selectedStock.produit?.nom || `Stock ${selectedStock.id}`}</div>
                  <div className="small text-muted">Stock disponible : {selectedStock.quantiteDisponible ?? 0} — Emplacement : {selectedStock.magasin?.nom || 'Boutique'}</div>
                </div>
              )}

              <div className="mb-2">
                <label className="form-label">Quantité</label>
                <input type="number" className="form-control" value={quantite as any} onChange={e => {
                  const val = e.target.value ? Number(e.target.value) : '';
                  if (selectedStock && val !== '' && Number(val) > Number(selectedStock.quantiteDisponible)) {
                    setQuantite(Number(selectedStock.quantiteDisponible));
                  } else {
                    setQuantite(val);
                  }
                }} min={1} max={selectedStock?.quantiteDisponible ?? undefined} />
                {selectedStock && <div className="small text-muted mt-1">Disponible: {selectedStock.quantiteDisponible ?? 0}</div>}
              </div>

              <div className="mb-2">
                <label className="form-label">Type</label>
                <div>
                  <div className="form-check form-check-inline">
                    <input className="form-check-input" type="radio" id="t-util" name="sousType" value="UTILISATION" checked={sousType === 'UTILISATION'} onChange={() => setSousType('UTILISATION')} />
                    <label className="form-check-label" htmlFor="t-util">Utilisation</label>
                  </div>
                  <div className="form-check form-check-inline">
                    <input className="form-check-input" type="radio" id="t-perte" name="sousType" value="PERTE" checked={sousType === 'PERTE'} onChange={() => setSousType('PERTE')} />
                    <label className="form-check-label" htmlFor="t-perte">Perte</label>
                  </div>
                </div>
              </div>

              <div className="mb-2">
                <label className="form-label">Description (optionnelle)</label>
                <input type="text" className="form-control" value={description} onChange={e => setDescription(e.target.value)} />
              </div>

            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => onClose && onClose()}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={loading || !!validate()}>{loading ? 'Enregistrement...' : 'Enregistrer'}</button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop show custom-modal-backdrop" />
    </div>
  );
};

export default UtilisationForm;
