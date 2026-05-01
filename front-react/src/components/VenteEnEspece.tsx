import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import SearchableSelect from './SearchableSelect';
import RequirePermission from './RequirePermission';
import { useFormatMoney } from '../utils/currency';
import { API } from '../config/api';
import { useUser } from '../contexts/UserContext';

interface Line {
  id_stock?: number;
  produit?: any;
  designation?: string;
  quantite?: number; // units
  venteParConditionnement?: boolean;
  quantiteConditionnement?: number; // number of packs
  prix?: number;
  priceMode?: string;
  quantiteReelle?: number; // computed
}

const VenteEnEspece: React.FC = () => {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<any[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [nomClient, setNomClient] = useState<string>('Clients divers');
  const [montantRecu, setMontantRecu] = useState<number | null>(null);
  const [remise, setRemise] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const fmt = useFormatMoney();

  // Location (boutique / magasin)
  const [magasins, setMagasins] = useState<any[]>([]);
  const [locationType, setLocationType] = useState<'BOUTIQUE'|'MAGASIN'>('BOUTIQUE');
  const [selectedMagasinId, setSelectedMagasinId] = useState<number | null>(null);
  // By default sales occur in the boutique and the emplacement is locked; certain users can unlock
  const [locationLocked, setLocationLocked] = useState<boolean>(true);

  const { currentBoutique } = useUser();

  const fetchMagasins = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${API}/magasins`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) throw new Error('Erreur lors du chargement des magasins');
      const data = await res.json();
      setMagasins(data || []);
      return data || [];
    } catch (e: any) {
      console.error('fetchMagasins error', e);
      return [];
    }
  };

  const fetchStocksByLocation = async (locType?: 'BOUTIQUE'|'MAGASIN', magId?: number) => {
    try {
      const token = getAuthToken();
      const lt = locType || locationType;
      if (lt === 'MAGASIN') {
        const idToUse = magId || selectedMagasinId;
        if (!idToUse) return [];
        const res = await fetch(`${API}/magasins/${idToUse}/stocks`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (!res.ok) throw new Error('Impossible de charger les produits du magasin');
        const data = await res.json();
        setStocks(data || []);
        return data || [];
      } else {
        const res = await fetch(`${API}/stocks`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (!res.ok) throw new Error('Impossible de charger les stocks');
        const data = await res.json();
        const boutiqueOnly = (data || []).filter((s: any) => !s.magasin);
        setStocks(boutiqueOnly);
        return boutiqueOnly;
      }
    } catch (e: any) {
      Swal.fire('Erreur', e.message || 'Erreur lors du chargement des stocks', 'error');
      return [];
    }
  };

  // Price mode (DÉTAIL or GROS) like in CommandeFournisseur
  const [priceModeDefault, setPriceModeDefault] = useState<'DETAIL'|'GROS'>('DETAIL');
  const [reference, setReference] = useState('');
  const [dateVente, setDateVente] = useState('');

  const generateReference = () => {
    const now = new Date();
    const ref = `ES-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}-${Math.random().toString(36).substr(2,6).toUpperCase()}`;
    setReference(ref);
  };

  useEffect(() => {
    // initialize reference and date like CommandeFournisseur
    generateReference();
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localDt = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setDateVente(localDt);
  }, []);

  const getAuthToken = (): string | null => {
    const raw = localStorage.getItem('smb_token');
    if (!raw) return null;
    try {
      const trimmed = raw.trim();
      if (trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed);
        return parsed?.token || parsed?.accessToken || parsed?.jwt || parsed?.authToken || null;
      }
    } catch (e) {
      // not json
    }
    if (raw.startsWith('Bearer ')) return raw.slice('Bearer '.length);
    return raw;
  };

  useEffect(() => {
    (async () => {
      await fetchMagasins();
      // Vente defaults to boutique (dépôt boutique)
      setLocationType('BOUTIQUE');
      setSelectedMagasinId(null);
      // keep location locked by default
      setLocationLocked(true);
      await fetchStocksByLocation('BOUTIQUE');
    })();
    // Par défaut le panier doit être vide (aucune ligne initiale)
  }, []);



  const removeLine = (index: number) => setLines(lines.filter((_, i) => i !== index));

  const handleLineChange = (index: number, field: keyof Line, value: any) => {
    const copy = [...lines];
    (copy[index] as any)[field] = value;
    setLines(copy);
  };

  // Add a product selected from SearchableSelect into the cart
  const handleProductSelect = (stockIdStr?: string | null) => {
    if (!stockIdStr) return;
    const id = Number(stockIdStr);
    const stock = stocks.find(s => s.id === id);
    if (!stock) {
      Swal.fire('Erreur', 'Stock introuvable', 'error');
      return;
    }
    if (lines.some(l => l.id_stock === id)) {
      Swal.fire('Attention', 'Ce produit est déjà présent dans le panier', 'warning');
      return;
    }
    // Determine default price for sale based on priceModeDefault like CommandeFournisseur
    const prod = stock.produit || {};
    const modePrice = priceModeDefault === 'DETAIL' ? (prod.prixDetail ?? prod.prixAchat) : (prod.prixEnGros ?? prod.prixAchat);
    const defaultPrice = modePrice ?? 0;
    // Default: checkbox should be unchecked (user explicitly requested checkbox default unchecked)
    const defaultVenteParConditionnement = false;
    const initialQuantiteUnits = 1;

    const newLine: Line = {
      id_stock: id,
      produit: prod,
      designation: prod.nomProduit || prod.nom || 'Produit',
      quantite: initialQuantiteUnits,
      venteParConditionnement: defaultVenteParConditionnement,
      quantiteConditionnement: undefined,
      prix: Number(defaultPrice),
      priceMode: priceModeDefault
    };
    setLines(prev => [...prev, newLine]);
  };

  const formatFCFA = (n: number) => fmt(n); 
  const computeLineQuantiteReelle = (l: Line) => {
    if (l.venteParConditionnement) {
      const stock = stocks.find(s => s.id === l.id_stock);
      const mul = stock && stock.produit && stock.produit.nombreUnitesParConditionnement ? stock.produit.nombreUnitesParConditionnement : 1;
      return (l.quantiteConditionnement || 0) * mul;
    }
    return l.quantite || 0;
  };

  const computeTotal = () => {
    const subtotal = lines.reduce((acc, l) => {
      const q = computeLineQuantiteReelle(l);
      const p = l.prix || 0;
      return acc + q * p;
    }, 0);
    return subtotal - (remise || 0);
  };

  // Client-side submission validation
  const { canSubmit, submissionErrors } = useMemo(() => {
    const errors: string[] = [];
    // Must have at least one valid line
    const validLines = lines.filter(l => l.id_stock && computeLineQuantiteReelle(l) > 0);
    if (validLines.length === 0) {
      errors.push('Veuillez ajouter au moins un produit avec une quantité valide.');
    }

    // Check stock availability and magasin restriction
    validLines.forEach(l => {
      const stock = stocks.find(s => s.id === l.id_stock);
      if (!stock) {
        errors.push(`Stock introuvable pour un produit sélectionné.`);
        return;
      }
      if (stock.magasin) {
        errors.push(`Le produit ${(stock.produit && (stock.produit.nomProduit || stock.produit.nom)) || ''} provient d'un magasin et ne peut pas être vendu directement.`);
      }
      const qreelle = computeLineQuantiteReelle(l);
      if ((stock.quantiteDisponible || 0) < qreelle) {
        errors.push(`Stock insuffisant pour ${(stock.produit && (stock.produit.nomProduit || stock.produit.nom)) || ''} (disponible: ${stock.quantiteDisponible || 0}, demandé: ${qreelle}).`);
      }

      // If sale is issued from a conditionnement, enforce rules
      if (l.venteParConditionnement) {
        const mult = stock.produit?.nombreUnitesParConditionnement || 1;
        if (!mult || mult <= 1) {
          errors.push(`Conditionnement non autorisé pour ${(stock.produit && (stock.produit.nomProduit || stock.produit.nom)) || ''}.`);
        }
        if (l.quantiteConditionnement == null || l.quantiteConditionnement < 1) {
          errors.push(`Quantité de conditionnements invalide pour ${(stock.produit && (stock.produit.nomProduit || stock.produit.nom)) || ''}.`);
        } else {
          const totalOpen = (l.quantiteConditionnement || 0) * (mult || 1);
          if ((l.quantite || 0) <= 0 || (l.quantite || 0) > totalOpen) {
            errors.push(`Quantité vendue invalide pour ${(stock.produit && (stock.produit.nomProduit || stock.produit.nom)) || ''} (max ouvrable: ${totalOpen}).`);
          }
        }
      }
    });

    const total = computeTotal();
    if (total <= 0) {
      errors.push('Le total doit être strictement supérieur à 0.');
    }

    // Montant reçu must be provided and >= total
    if (montantRecu == null) {
      errors.push('Le montant reçu doit être renseigné.');
    } else if (montantRecu < total) {
      errors.push('Le montant reçu est insuffisant.');
    }

    // can submit if no errors and not loading
    return { canSubmit: errors.length === 0 && !loading, submissionErrors: errors };
  }, [lines, stocks, remise, montantRecu, loading]);

  // If price mode or stocks change, recompute prices for existing lines following the global mode
  React.useEffect(() => {
    setLines(prev => prev.map(l => {
      if (!l.id_stock || !l.produit) return l;
      const prod = l.produit;
      const modePrice = priceModeDefault === 'DETAIL' ? (prod.prixDetail ?? prod.prixAchat) : (prod.prixEnGros ?? prod.prixAchat);
      const newPrix = modePrice ?? (l.prix || 0);
      return { ...l, prix: Number(newPrix), priceMode: priceModeDefault };
    }));
  }, [priceModeDefault, stocks]);


  const monnaieRembourse = () => {
    const total = computeTotal();
    if (montantRecu == null) return 0;
    return Math.max((montantRecu || 0) - total, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // validate lines
    const validLines = lines.filter(l => l.id_stock && (l.quantite || l.quantiteConditionnement));
    if (validLines.length === 0) {
      Swal.fire('Attention', 'Veuillez ajouter au moins un produit avec une quantité', 'warning');
      return;
    }

    const payload = {
      reference: `ES-${new Date().toISOString().replace(/[:.]/g, '').slice(0,15)}`,
      // send date with timezone offset so server records the intended local wall-clock time
      dateVente: (() => {
        const d = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const offsetMin = -d.getTimezoneOffset(); // minutes ahead of UTC
        const sign = offsetMin >= 0 ? '+' : '-';
        const oh = Math.floor(Math.abs(offsetMin) / 60);
        const om = Math.abs(offsetMin) % 60;
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}${sign}${pad(oh)}:${pad(om)}`;
      })(),
      nomClient: nomClient || 'Clients divers',
      total: computeTotal(),
      montantRecu: montantRecu || 0,
      monnaieRembourse: monnaieRembourse(),
      remise: remise || 0,
      produitsSelectionnes: validLines.map(l => ({
        id_stock: l.id_stock,
        quantite: l.quantite,
        venteParConditionnement: l.venteParConditionnement || false,
        quantiteConditionnement: l.venteParConditionnement ? l.quantiteConditionnement : undefined,
        prix: l.prix || 0,
        priceMode: l.priceMode || priceModeDefault
      }))
    };

    setLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API}/ventes/cash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        Swal.fire('Succès', 'Vente en espèces enregistrée', 'success');
        // Stay on the same page and reset the form to allow another sale
        setLines([]);
        setMontantRecu(null);
        setRemise(0);
        generateReference();
        // reset dateVente to current local datetime (same format used initially)
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const localDt = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
        setDateVente(localDt);
        // refresh stocks in case quantities changed
        await fetchStocksByLocation();
      } else {
        const err = await res.json().catch(() => null);
        console.debug('create vente cash failed', { status: res.status, body: err });
        Swal.fire('Erreur', (err && err.error) ? err.error : 'Erreur lors de la création de la vente', 'error');
      }
    } catch (e: any) {
      Swal.fire('Erreur', e.message || 'Erreur lors de la création de la vente', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="row">
        <div className="col-12">
          <div className="card">
              <div className="card-header">
                <h5>Vente En Espece</h5>
              </div>
              <div className="card-body">
                <div className="page-breadcrumb d-flex flex-column flex-sm-row align-items-start align-items-sm-center mb-3">
                  <div className="breadcrumb-title pe-3">Vente</div>
                  <div className="ps-0 ps-sm-3 mt-2 mt-sm-0">
                    <nav aria-label="breadcrumb">
                      <ol className="breadcrumb mb-0 p-0">
                        <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
                        <li className="breadcrumb-item active" aria-current="page">Vente En Direct</li>
                      </ol>
                    </nav>
                  </div>
                  <div className="ms-sm-auto mt-2 mt-sm-0">
                    <div className="btn-group">
                      <button className="btn btn-outline-primary me-2" onClick={() => navigate('/ventes/especes')}>Liste Ventes</button>
                    </div>
                  </div>
                </div>
              <form onSubmit={handleSubmit}>
                <div className="mb-3 row">
                  <div className="col-md-3">
                    <label>Référence</label>
                    <input type="text" className="form-control" value={reference} readOnly />
                  </div>
                  <div className="col-md-3">
                    <label>Date et Heure</label>
                    <input type="datetime-local" className="form-control" value={dateVente} readOnly />
                  </div>
                  <div className="col-md-2">
                    <label>Mode de prix</label>
                    <div className="form-check form-switch">
                      <input className="form-check-input" id="priceModeToggleEspece" type="checkbox" checked={priceModeDefault === 'DETAIL'} onChange={(e) => setPriceModeDefault(e.target.checked ? 'DETAIL' : 'GROS')} />
                      <label className="form-check-label" htmlFor="priceModeToggleEspece">{priceModeDefault === 'DETAIL' ? 'DÉTAIL' : 'GROS'}</label>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <label>Client</label>
                    <input className="form-control" value={nomClient} onChange={e => setNomClient(e.target.value)} />
                  </div>
                </div>

                <div className="row">
                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-header bg-dark text-white">Produits Disponible</div>
                      <div className="card-body">
                        <div className="row gy-2 gx-3 align-items-end">
                          <div className="col-12 col-sm-4">
                            <div className="d-flex flex-column gap-2">
                              <label className="form-label small mb-1 text-muted">Dépôt / Emplacement</label>
                              <select
                                className="form-select form-select-sm"
                                disabled={locationLocked}
                                value={locationType === 'MAGASIN' ? `MAGASIN:${selectedMagasinId || ''}` : 'BOUTIQUE'}
                                onChange={async (e) => {
                                  const val = e.target.value;
                                  if (val.startsWith('MAGASIN:')) {
                                    const idVal = Number(val.split(':')[1]);
                                    setLocationType('MAGASIN');
                                    setSelectedMagasinId(idVal);
                                    await fetchStocksByLocation('MAGASIN', idVal);
                                  } else {
                                    setLocationType('BOUTIQUE');
                                    setSelectedMagasinId(null);
                                    await fetchStocksByLocation('BOUTIQUE');
                                  }
                                }}
                              >
                                <option value="BOUTIQUE">Dépôt boutique</option>
                                {magasins.map(m => (
                                  <option key={m.id} value={`MAGASIN:${m.id}`}>{`Magasin - ${m.nom}`}</option>
                                ))}
                              </select>
                              <RequirePermission permission="VENTE_EMPLACEMENT_MODIFIER">
                                <div className="form-check form-switch">
                                  <input className="form-check-input" type="checkbox" id="unlock_location" checked={!locationLocked} onChange={async (e) => {
                                    const unlocked = e.target.checked;
                                    setLocationLocked(!unlocked);
                                    if (unlocked) {
                                      if (magasins && magasins.length > 0) {
                                        setLocationType('MAGASIN');
                                        setSelectedMagasinId(magasins[0].id);
                                        await fetchStocksByLocation('MAGASIN', magasins[0].id);
                                      } else {
                                        setLocationType('BOUTIQUE');
                                        setSelectedMagasinId(null);
                                        await fetchStocksByLocation('BOUTIQUE');
                                      }
                                    } else {
                                      setLocationType('BOUTIQUE');
                                      setSelectedMagasinId(null);
                                      await fetchStocksByLocation('BOUTIQUE');
                                    }
                                  }} />
                                  <label className="form-check-label small ms-2" htmlFor="unlock_location">Autoriser vente depuis magasin</label>
                                </div>
                              </RequirePermission>
                            </div>
                          </div>
                          <div className="col-12 col-sm-8">
                            <label className="form-label small mb-1 visually-hidden">Rechercher un produit</label>
                            <SearchableSelect
                              options={stocks.map(s => {
                                const prodName = (s.produit && (s.produit.nomProduit || s.produit.nom)) || (`Stock ${s.id}`);
                                const mult = s.produit?.nombreUnitesParConditionnement || 0;
                                const unitLabel = s.produit?.unite?.libelle || 'conditionnement';
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
                                const depotLabel = (locationType === 'MAGASIN') ? (s.magasin?.nom || s.magasin?.nomMagasin || String(s.magasin?.magasinId || '') || 'Dépôt magasin') : (currentBoutique?.nom || s.boutique?.nom || 'Dépôt boutique');
                                return { value: String(s.id), label: `${prodName}${multPart} — Stock : ${packagingLabel}`, depot: depotLabel };
                              })}
                              value={null}
                              onChange={(v) => handleProductSelect(v as string)}
                              placeholder="Rechercher un produit..."
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-header bg-dark text-white">Panier</div>
                      <div className="card-body">
                        {stocks.filter(s => (s.quantiteDisponible || 0) === 0).length > 0 && (
                          <div className="alert alert-warning">
                            <strong>Ruptures de stock :</strong>
                            <ul className="mb-0 mt-2">
                              {stocks.filter(s => (s.quantiteDisponible || 0) === 0).map(s => (
                                <li key={s.id}>{s.produit?.nomProduit || s.produit?.nom || `Stock ${s.id}`}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="table-responsive">
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Produit</th>
                                <th>Conditionnement</th>
                                <th>Quantité</th>
                                <th>Prix (unité)</th>
                                <th>Montant</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {lines.map((l, idx) => {
                                const qreelle = computeLineQuantiteReelle(l);
                                const montant = qreelle * (l.prix || 0);
                                return (
                                  <tr key={idx}>
                                    <td>{l.designation || (l.produit && (l.produit.nomProduit || l.produit.nom)) || '—'}</td>
                                    <td>
                                      <div className="form-check">
                                        <input className="form-check-input" type="checkbox" checked={!!l.venteParConditionnement} onChange={e => {
                                          const checked = e.target.checked;
                                          const stock = stocks.find(s => s.id === l.id_stock);
                                          const mult = stock?.produit?.nombreUnitesParConditionnement || 1;
                                          if (checked && (!mult || mult <= 1)) {
                                            Swal.fire('Interdit', 'La vente issue d\'un conditionnement n\'est pas autorisée pour ce produit.', 'error');
                                            return;
                                          }
                                          // When enabling, set default quantiteConditionnement and adjust unit quantity
                                          if (checked) {
                                            const defaultQCond = l.quantiteConditionnement || 1;
                                            const totalOpen = defaultQCond * (mult || 1);
                                            const newQuant = Math.min(l.quantite || 0, totalOpen) || Math.min(1, totalOpen);
                                            handleLineChange(idx, 'quantiteConditionnement', defaultQCond);
                                            handleLineChange(idx, 'quantite', newQuant);
                                          } else {
                                            handleLineChange(idx, 'quantiteConditionnement', undefined);
                                          }
                                          handleLineChange(idx, 'venteParConditionnement', checked);
                                        }} id={`cond-${idx}`} />
                                        <label className="form-check-label" htmlFor={`cond-${idx}`}>Par conditionnement</label>
                                      </div>
                                    </td>
                                    <td style={{ minWidth: 'min(200px, 90vw)' }}>
                                      <div style={{ display: 'flex', gap: 8 }}>
                                        {!l.venteParConditionnement ? (
                                          <div style={{ flex: 1 }}>
                                            <label className="form-label small mb-1">Vendu (unités)</label>
                                            <input type="number" min={0} className="form-control" value={l.quantite ?? ''} onChange={e => handleLineChange(idx, 'quantite', e.target.value === '' ? '' : Number(e.target.value))} />
                                          </div>
                                        ) : (
                                          <div style={{ width: 140 }}>
                                            {(() => { const unitRaw = l.produit?.unite?.libelle ?? 'emballage'; const unitLabel = typeof unitRaw === 'string' ? unitRaw : String(unitRaw); return (<><label className="form-label small mb-1">Quantité ({unitLabel})</label><input type="number" min={0} className="form-control" value={l.quantiteConditionnement ?? ''} onChange={e => handleLineChange(idx, 'quantiteConditionnement', e.target.value === '' ? undefined : Number(e.target.value))} /></>); })()}
                                          </div>
                                        )}
                                      </div>
                                      <small className="text-muted">{l.venteParConditionnement && (l.quantiteConditionnement ?? 0) > 0 ? (() => {
                                        const q = l.quantiteConditionnement || 0;
                                        const unitRaw = l.produit?.unite?.libelle ?? 'cond';
                                        const unit = typeof unitRaw === 'string' ? unitRaw : String(unitRaw);
                                        const unitPlural = (q > 1 && !unit.toLowerCase().endsWith('s')) ? `${unit}s` : unit;
                                        return `${q} ${unitPlural} ≈ ${qreelle} unités — Vendu: ${l.quantite || 0} unités`;
                                      })() : (() => {
                                        const stock = stocks.find(st => st.id === l.id_stock);
                                        if (!stock) return `Réel: ${qreelle}`;
                                        // compute total units for the same stock across lines (including this one)
                                        const totalUnits = lines.reduce((s, ln) => s + (computeLineQuantiteReelle(ln) || 0), 0);
                                        const stockAfter = (stock.quantiteDisponible || 0) - totalUnits;
                                        const mult = stock.produit?.nombreUnitesParConditionnement || 1;
                                        if (mult > 1) {
                                          const full = Math.floor(stockAfter / mult);
                                          const rem = ((stockAfter % mult) + mult) % mult;
                                          if (rem > 0) return `Carton ouvert — reste ${rem} unité${rem > 1 ? 's' : ''} dans le carton`;
                                          return `${stockAfter} unités (${full} carton${full > 1 ? 's' : ''})`;
                                        }
                                        return `${stockAfter} unité${stockAfter > 1 ? 's' : ''}`;
                                      })()}</small>
                                    </td>
                                    <td>
                                      <div className="input-group">
                                        {l.venteParConditionnement && (l.quantiteConditionnement || 0) > 0 ? (
                                          <input type="text" className="form-control" value={`${formatFCFA((l.prix||0) * (l.produit?.nombreUnitesParConditionnement ?? 1))} / ${l.produit?.unite?.libelle || l.produit?.uniteConditionnement || 'carton'}`} readOnly />
                                        ) : (
                                          <input type="number" min={0} className="form-control" value={l.prix || 0} onChange={e => handleLineChange(idx, 'prix', Number(e.target.value))} disabled />
                                        )}
                                        <span className="input-group-text" title="Prix automatique"><i className="bx bx-lock"></i></span>
                                      </div>
                                    </td>
                                    <td>{formatFCFA(montant)}</td>
                                    <td>
                                      <button type="button" className="btn btn-danger btn-sm" onClick={() => removeLine(idx)} title="Supprimer"><i className="bx bx-trash"></i></button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan={3} className="text-end fw-bold">Total :</td>
                                <td className="fw-bold">{formatFCFA(computeTotal())}</td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row mt-3">
                  <div className="col-12">
                    <div className="card">
                      <div className="card-header bg-dark text-white">Paiement</div>
                      <div className="card-body">
                        <div className="row">
                          <div className="col-md-4">
                            <label className="form-label">Remise</label>
                            <input className="form-control" type="number" value={remise} onChange={e => setRemise(Number(e.target.value))} />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label">Montant Reçu</label>
                            <input className="form-control" type="number" value={montantRecu == null ? '' : montantRecu} onChange={e => setMontantRecu(e.target.value === '' ? null : Number(e.target.value))} />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label">Monnaie à rendre</label>
                            <input className="form-control" readOnly value={formatFCFA(monnaieRembourse())} />
                          </div>
                        </div>

                        <div className="row mt-3">
                          <div className="col-12">
                            {submissionErrors.length > 0 && (
                              <div className="alert alert-danger">
                                <ul className="mb-0">
                                  {submissionErrors.map((err, i) => <li key={i}>{err}</li>)}
                                </ul>
                              </div>
                            )}
                            <div className="text-center">
                              <RequirePermission permission={'VENTE_CREER'}>
                                <button type="submit" className="btn btn-primary" disabled={!canSubmit}>{loading ? 'Enregistrement…' : 'Enregistrer la vente'}</button>
                              </RequirePermission>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>


              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VenteEnEspece;