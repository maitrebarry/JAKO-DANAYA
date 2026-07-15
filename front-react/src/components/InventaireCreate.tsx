import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import Swal from 'sweetalert2';
import * as inventaireApi from '../api/inventaire';
import { withApi } from '../config/api';

const AUTH_HEADER = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

const InventaireCreate: React.FC = () => {
  const [magasins, setMagasins] = useState<any[]>([]);
  // '' = boutique scope; otherwise the string id of the selected magasin
  const [selectedMagasinId, setSelectedMagasinId] = useState<string>('');
  const [products, setProducts] = useState<any[]>([]);
  const [temps, setTemps] = useState<Record<number, { condCount?: number; unitCount?: number; qtePhysique?: number; ecart?: number }>>({});
  const [reference, setReference] = useState('');
  const [dateInventaire, setDateInventaire] = useState(new Date().toISOString().slice(0, 16));
  const navigate = useNavigate();
  const { currentBoutique } = useUser();

  useEffect(() => {
    fetchMagasins();
    // fetch preview reference
    (async () => {
      try {
        const ref = await inventaireApi.getNextReference();
        if (ref) setReference(ref);
      } catch (e) {
        // ignore silently
      }
    })();
  }, []);

  useEffect(() => {
    loadProductsForScope();
    setTemps({});
  }, [currentBoutique?.id, selectedMagasinId]);

  const fetchMagasins = async () => {
    try {
      const res = await fetch(withApi('magasins'), { headers: AUTH_HEADER() });
      if (!res.ok) throw new Error('Erreur chargement magasins');
      const data = await res.json();
      setMagasins(data || []);
    } catch (err) {
      console.error('fetchMagasins', err);
    }
  };

  const loadProductsForScope = async () => {
    try {
      const url = selectedMagasinId
        ? withApi(`stocks?magasinId=${selectedMagasinId}`)
        : withApi('stocks?level=boutique');
      const res = await fetch(url, { headers: AUTH_HEADER() });
      if (!res.ok) throw new Error('Erreur chargement stocks');
      const stocks = await res.json();
      const items = (stocks || []).map((s: any) => ({
        id: s.produit?.id,
        nom: s.produit?.nomProduit || s.produit?.nom,
        quantiteVirtuelle: s.quantiteDisponible || 0,
        produit: s.produit,
        magasin: s.magasin || null,
        packagingLabel: (() => {
          const mult = s.produit?.nombreUnitesParConditionnement || 1;
          const u = Number(s.quantiteDisponible || 0);
          const unitLibelle = s.produit?.uniteConditionnement || s.produit?.unite?.libelle || 'emballage';
          if (!mult || mult <= 1) return `${u} unité${u > 1 ? 's' : ''}`;
          const full = Math.floor(u / mult);
          const rem = u % mult;
          if (rem === 0) return `${u} unités (${full} ${unitLibelle}${full > 1 ? 's' : ''})`;
          const openPart = rem > 1 ? `${rem} unités ouvertes` : `${rem} unité ouverte`;
          const fullPart = full > 0 ? `${full} ${unitLibelle}${full > 1 ? 's' : ''} + ` : '';
          return `${u} unités (${fullPart}${openPart})`;
        })()
      }));
      setProducts(items);
    } catch (e) {
      console.error('loadProductsForScope', e);
      setProducts([]);
    }
  };


  const handleSubmit = async () => {
    // Create inventaire minimal then create lignes for non-zero entries.
    // If an active inventaire already exists for the same scope (boutique, or the
    // selected magasin), offer to reuse/open it — the backend enforces a single
    // active inventaire per scope.
    try {
      if (!currentBoutique || !currentBoutique.id) {
        await Swal.fire('Erreur', 'Boutique courante introuvable. Veuillez vous reconnecter.', 'error');
        return;
      }

      const wantedMagasinId = selectedMagasinId ? Number(selectedMagasinId) : null;

      // check for an existing active inventaire matching this exact scope
      const existing = await inventaireApi.listInventaires(currentBoutique.id).catch(() => []);
      const active = (existing || []).find((i: any) => !i.regulariser && ((i.magasin?.id ?? null) === wantedMagasinId));
      let inventaireId: number | null = null;

      if (active) {
        const scopeLabel = wantedMagasinId ? (magasins.find(m => m.id === wantedMagasinId)?.nom || 'ce magasin') : 'la boutique';
        const choice = await Swal.fire({
          title: 'Inventaire actif détecté',
          html: `Un inventaire actif existe déjà pour ${scopeLabel} (${active.reference || active.referenceInventaire || '—'}).<br/>Voulez-vous l'ouvrir pour y ajouter vos lignes ?`,
          icon: 'info',
          showCancelButton: true,
          confirmButtonText: 'Ouvrir inventaire actif',
          cancelButtonText: 'Annuler'
        });
        if (!choice.isConfirmed) return;
        inventaireId = active.idInventaire || active.id;
      }

      // If no active inventaire for this scope -> create new one
      if (!inventaireId) {
        const payload = { boutique: { id: currentBoutique.id }, dateInventaire } as any;
        if (wantedMagasinId) payload.magasin = { id: wantedMagasinId };
        const inv = await inventaireApi.createInventaire(payload);
        inventaireId = inv.idInventaire || inv.id;
      }

      // add lignes to the selected/reused inventaire
      for (const [prodIdStr, data] of Object.entries(temps)) {
        const prodId = Number(prodIdStr);
        const prod = products.find(p => p.id === prodId);
        const perCond = prod?.produit?.nombreUnitesParConditionnement ?? prod?.nombreUnitesParConditionnement ?? 1;
        const cond = data?.condCount || 0;
        const units = data?.unitCount || 0;
        const totalUnits = cond * perCond + units;
        if (totalUnits > 0 && inventaireId) {
          await inventaireApi.addLigneInventaire(inventaireId, { produitId: prodId, quantiteConditionnement: cond, quantiteUnite: units });
        }
      }

      await Swal.fire('Succès', inventaireId ? 'Lignes ajoutées à l\'inventaire actif' : 'Inventaire créé', 'success');
      navigate('/inventaires');
    } catch (e: any) {
      // show backend error body if possible
      let msg = 'Erreur création inventaire';
      try {
        const body = typeof e === 'string' ? e : (e && e.message) ? e.message : null;
        msg = body || msg;
      } catch (err) {
        // ignore
      }
      await Swal.fire('Erreur', msg, 'error');
    }
  };

  return (
    <>
    <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Inventaire</div>
        <div className="ps-3">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 p-0">
              <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
              <li className="breadcrumb-item active" aria-current="page">Création de l' Inventaire</li>
            </ol>
          </nav>
        </div>
        <div className="ms-auto">
          <div className="btn-group" />
        </div>
      </div>

      <hr />
    <div>
      <div className="d-flex align-items-center mb-3">
        <div className="ms-auto">
          <button className="btn btn-secondary" onClick={() => navigate('/inventaires')}>Retour à la liste</button>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-center">
            <div className="col-md-3">
              <label className="form-label">Portée — où comptez-vous ?</label>
              <select className="form-control" value={selectedMagasinId} onChange={(e) => setSelectedMagasinId(e.target.value)}>
                <option value="">Boutique</option>
                {magasins.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.nom || `Magasin #${m.id}`}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Référence</label>
              <input className="form-control" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Générée automatiquement" disabled />
            </div>
            <div className="col-md-2">
              <label className="form-label">Date</label>
              <input type="datetime-local" className="form-control" value={dateInventaire} onChange={(e) => setDateInventaire(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center"><h5 className="mb-0">Produit</h5></div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>QTE VIRTUELLE</th>
                  <th>QTE PHYSIQUE</th>
                  <th>ECART STOCK</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const nombreParCond = p.produit?.nombreUnitesParConditionnement ?? p.nombreUnitesParConditionnement ?? 1;
                  const tmp = temps[p.id] || {};
                  const totalUnits = (tmp.condCount || 0) * (nombreParCond || 1) + (tmp.unitCount || 0);
                  const ec = (totalUnits || 0) - (p.quantiteVirtuelle || 0);
                  return (
                    <tr key={p.id}>
                      <td>
                        {p.nom}
                        {((temps[p.id]?.condCount ?? 0) > 0) && (() => {
                          const per = p.produit?.nombreUnitesParConditionnement ?? p.nombreUnitesParConditionnement ?? 1;
                          const unitLib = p.produit?.uniteConditionnement || p.produit?.unite?.libelle || 'emballage';
                          const cond = temps[p.id]?.condCount || 0;
                          const extra = temps[p.id]?.unitCount || 0;
                          const total = cond * per + extra;
                          const unitLabel = cond > 1 && !unitLib.endsWith('s') ? unitLib + 's' : unitLib;
                          return <div className="small text-muted">{cond} {unitLabel} {p.nom} dans unite:{total}</div>;
                        })()}
                      </td>
                      <td>{p.packagingLabel || (p.quantiteVirtuelle + ' unités')}</td>
                      <td>
                        { (nombreParCond && nombreParCond > 1) ? (
                          <div>
                            <div className="small text-muted mb-1">1 { (p.produit?.uniteConditionnement || p.produit?.unite?.libelle || 'emballage') } = {nombreParCond} unités</div>
                            <div className="row g-1">
                              <div className="col-4">
                                <input type="number" min={0} className="form-control" placeholder={p.produit?.uniteConditionnement || p.produit?.unite?.libelle || 'Emballages'} value={tmp.condCount ?? ''} onChange={(e) => {
                                  const cond = Number(e.target.value || 0);
                                  setTemps(prev => ({...prev, [p.id]: {...prev[p.id], condCount: cond}}));
                                }} />
                                <div className="small text-muted mt-1">Emballages</div>
                              </div>
                              <div className="col-4">
                                <input type="number" min={0} className="form-control" placeholder="Unités supplémentaires" value={tmp.unitCount ?? ''} onChange={(e) => setTemps(prev => ({...prev, [p.id]: {...prev[p.id], unitCount: Number(e.target.value || 0)}}))} />
                                <div className="small text-muted mt-1">Unités supplémentaires (ajoutées aux unités issues des emballages)</div>
                              </div>
                              <div className="col-4">
                                <div className="form-control" aria-readonly>{(tmp.condCount || 0) * (nombreParCond || 1)} + {(tmp.unitCount || 0)} = {(tmp.condCount || 0) * (nombreParCond || 1) + (tmp.unitCount || 0)} unités</div>
                                <div className="small text-muted mt-1">Unités depuis emballages + unités supplémentaires</div>
                              </div>
                            </div>
                            <div className="mt-1 small text-muted">{(tmp.condCount || 0)} × {nombreParCond || 1} = {(tmp.condCount || 0) * (nombreParCond || 1)} unités — + {(tmp.unitCount || 0)} unités supplémentaires — Total: {(tmp.condCount || 0) * (nombreParCond || 1) + (tmp.unitCount || 0)} unités</div>
                          </div>
                        ) : (
                          <input type="number" min={0} className="form-control" placeholder="Quantité" value={tmp.unitCount ?? ''} onChange={(e) => setTemps(prev => ({...prev, [p.id]: {...prev[p.id], unitCount: Number(e.target.value)}}))} />
                        )}
                      </td>
                      <td>{ec}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 d-flex justify-content-end">
            <button className="btn btn-primary" onClick={handleSubmit}>Valider</button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default InventaireCreate;