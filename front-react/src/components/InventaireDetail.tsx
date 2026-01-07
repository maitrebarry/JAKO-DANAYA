import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import RequirePermission from './RequirePermission';
import useHasPermission from '../contexts/useHasPermission';
import * as inventaireApi from '../api/inventaire';

const InventaireDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [inventaire, setInventaire] = useState<any | null>(null);
  const [lignes, setLignes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  // form state
  const [selectedProdId, setSelectedProdId] = useState<number | null>(null);
  const [condCount, setCondCount] = useState<number>(0);
  const [unitCount, setUnitCount] = useState<number>(0);
  const [adding, setAdding] = useState<boolean>(false);
  const canDelete = useHasPermission('INVENTAIRE_SUPPRIMER');

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const inv = await inventaireApi.getInventaire(Number(id));
      setInventaire(inv);
      const li = await inventaireApi.listLignes(Number(id));
      setLignes(li);
      // load products according to inventaire scope (boutique vs magasin)
      await fetchProducts(inv);
    } catch (e: any) {
      console.error(e);
      await Swal.fire('Erreur', e && e.message ? e.message : 'Erreur chargement inventaire', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async (inv?: any) => {
    try {
      const token = `Bearer ${localStorage.getItem('smb_token')}`;
      let stocks: any[] = [];
      if (inv && inv.magasin && inv.magasin.id) {
        // inventaire at magasin level -> fetch only that magasin stocks
        const res = await fetch(`http://localhost:8085/api/magasins/${inv.magasin.id}/stocks`, { headers: { Authorization: token } });
        if (!res.ok) return;
        stocks = await res.json();
      } else {
        // boutique-level inventaire -> only boutique stocks (id_magasin == null)
        const res = await fetch('http://localhost:8085/api/stocks', { headers: { Authorization: token } });
        if (!res.ok) return;
        stocks = await res.json();
        stocks = (stocks || []).filter((s: any) => !s.magasin);
      }

      // map stocks to product items and deduplicate by produit id
      const itemsMap = new Map<number, any>();
      (stocks || []).forEach((s: any) => {
        const prod = s.produit || {};
        const mult = prod.nombreUnitesParConditionnement || 1;
        const u = Number(s.quantiteDisponible || 0);
        const unitLibelle = prod.uniteConditionnement || prod.unite?.libelle || 'conditionnement';
        let packagingLabel = `${u} unité${u > 1 ? 's' : ''}`;
        if (mult && mult > 1) {
          const full = Math.floor(u / mult);
          const rem = u % mult;
          if (rem === 0) packagingLabel = `${u} unités (${full} ${unitLibelle}${full > 1 && !unitLibelle.endsWith('s') ? 's' : ''})`;
          else {
            const openPart = rem > 1 ? `${rem} unités ouvertes` : `${rem} unité ouverte`;
            const fullPart = full > 0 ? `${full} ${unitLibelle}${full > 1 && !unitLibelle.endsWith('s') ? 's' : ''} + ` : '';
            packagingLabel = `${u} unités (${fullPart}${openPart})`;
          }
        }
        const idProd = prod.id;
        if (!idProd) return;
        if (!itemsMap.has(idProd)) {
          itemsMap.set(idProd, { id: idProd, nom: prod.nomProduit || prod.nom, quantiteVirtuelle: u, produit: prod, packagingLabel, magasin: s.magasin || null });
        } else {
          // prefer magasin-specific stock if it matches inventaire magasin (more specific)
          if (s.magasin && inv && inv.magasin && s.magasin.id === inv.magasin.id) {
            itemsMap.set(idProd, { id: idProd, nom: prod.nomProduit || prod.nom, quantiteVirtuelle: u, produit: prod, packagingLabel, magasin: s.magasin || null });
          }
        }
      });

      setProducts(Array.from(itemsMap.values()));
    } catch (e) {
      console.error(e);
    }
  };

  const selectedProduct = products.find(p => p.id === selectedProdId);
  const nombreUnitesParConditionnement = selectedProduct?.produit?.nombreUnitesParConditionnement || 1;
  const totalUnits = condCount * (nombreUnitesParConditionnement || 1) + unitCount;

  const handleAddLigne = async () => {
    if (!selectedProdId || totalUnits <= 0) { await Swal.fire('Erreur', 'Produit et quantité valides requis', 'warning'); return; }
    if (!inventaire || inventaire.regulariser) { await Swal.fire('Erreur', 'Impossible : inventaire déjà régularisé', 'warning'); return; }
    if (adding) return; // prevent concurrent adds
    setAdding(true);
    try {
      // Prefer sending conditionnement + unités to backend to let it compute totalUnits
      const payload: any = { produitId: selectedProdId };
      if (nombreUnitesParConditionnement && nombreUnitesParConditionnement > 1) {
        payload.quantiteConditionnement = condCount;
        payload.quantiteUnite = unitCount;
      } else {
        payload.quantitePhysique = unitCount;
      }
      await inventaireApi.addLigneInventaire(Number(id), payload);
      setCondCount(0); setUnitCount(0); setSelectedProdId(null);
      await Swal.fire('Succès', 'Ligne ajoutée', 'success');
      await load();
    } catch (e: any) {
      await Swal.fire('Erreur', e && e.message ? e.message : 'Erreur ajout ligne', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await inventaireApi.exportInventaireCsv(Number(id));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventaire_${id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      if (e && e.status === 401) {
        const res = await Swal.fire({ title: 'Authentification requise', text: 'Votre session a expiré. Voulez-vous vous reconnecter ?', icon: 'warning', showCancelButton: true });
        if (res.isConfirmed) window.location.href = '/login';
        return;
      }
      await Swal.fire('Erreur', e && e.message ? e.message : 'Erreur export', 'error');
    }
  };

  const handleExportPdf = async () => {
    try {
      const blob = await inventaireApi.exportInventairePdf(Number(id));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventaire_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      if (e && e.status === 401) {
        const res = await Swal.fire({ title: 'Authentification requise', text: 'Votre session a expiré. Voulez-vous vous reconnecter ?', icon: 'warning', showCancelButton: true });
        if (res.isConfirmed) window.location.href = '/login';
        return;
      }
      await Swal.fire('Erreur', e && e.message ? e.message : 'Erreur export PDF', 'error');
    }
  };

  const autoAddTimer = useRef<number | null>(null);
  // Auto-add when a product is selected and a valid quantity is provided (debounced to avoid duplicate calls)
  useEffect(() => {
    if (!id) return;
    if (!selectedProdId) return;
    if (adding) return;
    if (!inventaire || inventaire.regulariser) return;
    if (autoAddTimer.current) {
      window.clearTimeout(autoAddTimer.current);
      autoAddTimer.current = null;
    }
    // debounce 300ms to allow quick quantity edits without multiple requests
    autoAddTimer.current = window.setTimeout(() => {
      if (selectedProdId && totalUnits > 0 && !adding) {
        handleAddLigne();
      }
      autoAddTimer.current = null;
    }, 300) as unknown as number;

    return () => { if (autoAddTimer.current) { window.clearTimeout(autoAddTimer.current); autoAddTimer.current = null; } };
  }, [selectedProdId, condCount, unitCount]);

  return (
    <>
      <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Inventaire</div>
        <div className="ps-3">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 p-0">
              <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
              <li className="breadcrumb-item"><a href="/inventaires">Liste Inventaires</a></li>
              <li className="breadcrumb-item active" aria-current="page">Détails</li>
            </ol>
          </nav>
        </div>
        <div className="ms-auto">
          <div className="btn-group" />
        </div>
      </div>

      {loading && <div>Chargement...</div>}
      {!loading && inventaire && (
        <div>
          <div className="mb-3">
            <strong>Référence:</strong> {inventaire.referenceInventaire || inventaire.reference}
            <span className="ms-3"><strong>Date:</strong> {inventaire.dateInventaire}</span>
            <span className="ms-3"><strong>Régularisé:</strong> {inventaire.regulariser ? 'Oui' : 'Non'}</span>
          </div>

          <div className="card mb-3">
            <div className="card-body">
              <h5>Ajouter une ligne</h5>

              <div className="row g-2 mb-2">
                <div className="col-md-4">
                  <label className="form-label">Référence</label>
                  <input className="form-control" value={inventaire.referenceInventaire || inventaire.reference || ''} readOnly />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Date</label>
                  <input className="form-control" value={inventaire.dateInventaire || ''} readOnly />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Régularisé</label>
                  <input className="form-control" value={inventaire.regulariser ? 'Oui' : 'Non'} readOnly />
                </div>
              </div>

              <div className="row g-2 align-items-end">
                <div className="col-md-4">
                  <label className="form-label">Produit</label>
                  <select className="form-control" value={selectedProdId ?? ''} onChange={(e) => setSelectedProdId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">-- Choisir --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{`${p.nom} — ${p.magasin?.nom || 'Dépôt boutique'} — Stock: ${p.packagingLabel || (p.quantiteVirtuelle + ' unités')}`}</option>)}
                  </select>
                  {selectedProduct && condCount > 0 && (() => {
                    const unitLib = selectedProduct?.produit?.uniteConditionnement || selectedProduct?.produit?.unite?.libelle || 'conditionnement';
                    const total = condCount * (nombreUnitesParConditionnement || 1) + (unitCount || 0);
                    const label = condCount > 1 && !unitLib.endsWith('s') ? unitLib + 's' : unitLib;
                    return <div className="small text-muted mt-1">{condCount} {label} {selectedProduct?.nom} — Total unités: {total}</div>;
                  })()} 
                </div>
                {(nombreUnitesParConditionnement && nombreUnitesParConditionnement > 1) ? (
                  <>
                    <div className="col-md-2">
                      <label className="form-label">{selectedProduct?.produit?.uniteConditionnement || selectedProduct?.produit?.unite?.libelle || 'Conditionnement'}</label>
                      <input type="number" className="form-control" min={0} value={condCount} onChange={(e) => {
                        const cond = Number(e.target.value);
                                            setCondCount(cond);
                      }} />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Unités</label>
                      <input type="number" className="form-control" min={0} value={unitCount} onChange={(e) => setUnitCount(Number(e.target.value))} />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Total unités</label>
                      <input type="text" className="form-control" value={`${condCount * (nombreUnitesParConditionnement || 1)} + ${unitCount} = ${totalUnits}`} readOnly />
                    </div>
                  </>
                ) : (
                  <div className="col-md-4">
                    <label className="form-label">Quantité</label>
                    <input type="number" className="form-control" min={0} value={unitCount} onChange={(e) => { setUnitCount(Number(e.target.value)); setCondCount(0); }} />
                  </div>
                )}
                <div className="col-12 mb-2"><small>{condCount} × {nombreUnitesParConditionnement || 1} = {condCount * (nombreUnitesParConditionnement || 1)} unités — + {unitCount || 0} unités supplémentaires — Total: {condCount * (nombreUnitesParConditionnement || 1) + (unitCount || 0)} unités</small></div>
              </div>
              {selectedProduct && nombreUnitesParConditionnement > 1 && (
                <div className="mt-2 small text-muted">1 {selectedProduct?.produit?.uniteConditionnement || selectedProduct?.produit?.unite?.libelle || 'conditionnement'} = {nombreUnitesParConditionnement} unités</div>
              )}
            </div>
          </div>

          <div className="mb-3">
            <h5>Produit</h5>
            <div className="small text-muted">Liste Produit</div>
          </div>
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Quantité physique</th>
                  <th>Ecart</th>
                  <th>Montant</th>
                  {canDelete && <th></th>}
                </tr>
              </thead>
              <tbody>
                {lignes.map(li => (
                  <tr key={li.id}>
                    <td>{li.produit?.nomProduit || li.produit?.nom}</td>
                    <td>{(() => {
                      const per = li.produit?.nombreUnitesParConditionnement || 1;
                      const q = li.quantitePhysique || 0;
                      if (!per || per <= 1) return `${q} unité${q > 1 ? 's' : ''}`;
                      const full = Math.floor(q / per);
                      const rem = q % per;
                      const unitLabel = li.produit?.uniteConditionnement || li.produit?.unite?.libelle || 'conditionnement';
                      if (rem === 0) return `${q} unités (${full} ${unitLabel}${full > 1 && !unitLabel.endsWith('s') ? 's' : ''})`;
                      const fullPart = full > 0 ? `${full} ${unitLabel}${full > 1 && !unitLabel.endsWith('s') ? 's' : ''} + ` : '';
                      return `${fullPart}${rem} unité${rem > 1 ? 's' : ''} (${q} unités)`;
                    })()}</td>
                    <td>{li.ecartStock ?? '-'}</td>
                    <td>{li.montant != null ? (li.montant).toLocaleString() + ' F CFA' : '-'}</td>
                    {canDelete && (
                      <td className="text-end">
                        {!inventaire.regulariser && (
                          <RequirePermission permission="INVENTAIRE_SUPPRIMER">
                            <button className="btn btn-danger btn-sm" title="Supprimer" onClick={async () => {
                              const resp = await Swal.fire({ title: 'Confirmation', text: 'Confirmer la suppression de cette ligne ?', icon: 'warning', showCancelButton: true });
                              if (!resp.isConfirmed) return;
                              try {
                                await inventaireApi.deleteLigneInventaire(Number(id), li.id);
                                await Swal.fire('Succès', 'Ligne supprimée', 'success');
                                await load();
                              } catch (e: any) {
                                await Swal.fire('Erreur', e && e.message ? e.message : 'Erreur suppression', 'error');
                              }
                            }}><i className="bx bx-trash"></i></button>
                          </RequirePermission>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-end">
            <strong>Total montant: </strong>{lignes.reduce((s, l) => s + (l.montant || 0), 0).toLocaleString()} F CFA
          </div>

          <div className="mt-3">
            <button className="btn btn-outline-secondary me-2" onClick={handleExport}>Exporter CSV</button>                       {/* Le bouton Régulariser est sur la page liste aussi, mais on peut le proposer ici */}
            {!inventaire.regulariser && (
              <button className="btn btn-warning" onClick={async () => {
                const resp = await Swal.fire({title: 'Confirmation', text: 'Confirmer la régularisation ? Cette action est irréversible.', icon: 'warning', showCancelButton: true});
                if (!resp.isConfirmed) return;
                try {
                  await inventaireApi.regularizeInventaire(Number(id));
                  await Swal.fire('Succès', 'Inventaire régularisé', 'success');
                  load();
                } catch (e: any) { await Swal.fire('Erreur', e && e.message ? e.message : 'Erreur', 'error'); }
              }}>Régulariser</button>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default InventaireDetail;