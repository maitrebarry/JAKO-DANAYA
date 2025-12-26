import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import SearchableSelect from './SearchableSelect';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';

interface Stock {
  id: number;
  quantiteDisponible: number;
  produit: {
    id: number;
    nomProduit: string;
    prixAchat: number;
  };
  magasin: {
    id: number;
    nom: string;
    adresse: string;
  };
}

interface Fournisseur {
  id: number;
  prenom: string;
  nom: string;
  contact: string;
}

interface CartItem {
  id_stock: number;
  nom: string;
  quantite: number;
  prix: number;
  montant: number;
}

const CommandeFournisseur: React.FC = () => {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedFournisseur, setSelectedFournisseur] = useState('');
  const { id } = useParams();
  const [isEditMode, setIsEditMode] = useState(false);
  const [reference, setReference] = useState('');
  const [dateCommande, setDateCommande] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStockOption, setSelectedStockOption] = useState<string | number | null>(null);

  // Fournisseur modal state
  const [showFournisseurModal, setShowFournisseurModal] = useState(false);
  const [newFournisseur, setNewFournisseur] = useState<{ prenom?: string; nom?: string; contact?: string; ville?: string }>({});
  const [fournisseurSearch, setFournisseurSearch] = useState('');

  useEffect(() => {
    (async () => {
      const s = await fetchStocks();
      await fetchFournisseurs();
      generateReference();
      setDateCommande(new Date().toISOString().slice(0, 16));
      if (id) {
        setIsEditMode(true);
        await fetchCommandeForEdit(parseInt(id), s);
      }
    })();
  }, [id]);

  // Ensure body class and scrolling behavior while modal is open
  useEffect(() => {
    if (showFournisseurModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [showFournisseurModal]);

  const fetchCommandeForEdit = async (commandeId: number, loadedStocks?: Stock[]) => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/commandes-fournisseurs/${commandeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors du chargement de la commande');
      const data = await res.json();
      // populate form
      setReference(data.reference || '');
      // convert server date to yyyy-MM-ddTHH:mm
      if (data.dateCommande) {
        const d = new Date(data.dateCommande);
        const dt = d.toISOString().slice(0,16);
        setDateCommande(dt);
      }
      setSelectedFournisseur(data.fournisseur?.id ? String(data.fournisseur.id) : '');
      // build cart from lignes
      if (data.lignes) {
        const stocksRef = loadedStocks && loadedStocks.length > 0 ? loadedStocks : stocks;
        const loadedCart = data.lignes.map((l: any) => {
          const stockId = l.stock?.id;
          const stockInfo = stocksRef ? stocksRef.find(s => s.id === stockId) : undefined;
          const nomProduit = stockInfo?.produit?.nomProduit || (l.stock?.produit?.nomProduit || 'Produit inconnu');
          const basePrice = Number(stockInfo?.produit?.prixAchat ?? l.stock?.produit?.prixAchat ?? 0);
          const prix = l.newPrice !== undefined && l.newPrice !== null ? Number(l.newPrice) : basePrice;
          const quantite = l.quantite || 1;
          return { id_stock: stockId, nom: nomProduit, quantite, prix, montant: prix * quantite };
        });
        setCart(loadedCart);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    }
  };

  const generateReference = () => {
    const now = new Date();
    const ref = `CMD-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    setReference(ref);
  };

  const fetchStocks = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch('http://localhost:8085/api/stocks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors du chargement des stocks');
      const data = await res.json();
      setStocks(data);
      return data;
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const fetchFournisseurs = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch('http://localhost:8085/api/fournisseurs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors du chargement des fournisseurs');
      const data = await res.json();
      setFournisseurs(data);
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    }
  };

  const handleProductSelect = (stockId: string) => {
    try {
      const stock = stocks.find(s => s.id.toString() === stockId);
      if (!stock || !stock.produit) {
        Swal.fire('Erreur', 'Produit introuvable', 'error');
        return;
      }

      // Check if already in cart
      if (cart.some(item => item.id_stock === stock.id)) {
        Swal.fire('Erreur', 'Ce produit est déjà dans le panier', 'error');
        return;
      }

      // Get last used price for this product from localStorage
      const lastPriceKey = `lastPrice_${stock.produit.id}`;
      const lastPrice = localStorage.getItem(lastPriceKey);
      const defaultPrice = lastPrice ? parseFloat(lastPrice) : Number(stock.produit?.prixAchat ?? 0);

      if (defaultPrice <= 0) {
        Swal.fire('Attention', 'Le prix de ce produit n\'est pas défini. Veuillez le saisir manuellement.', 'warning');
      }

      const newItem: CartItem = {
        id_stock: stock.id,
        nom: stock.produit.nomProduit,
        quantite: 1,
        prix: defaultPrice,
        montant: defaultPrice
      };

      setCart([...cart, newItem]);
    } catch (error) {
      console.error('Erreur lors de la sélection du produit:', error);
      Swal.fire('Erreur', 'Une erreur est survenue lors de la sélection du produit', 'error');
    }
  };

  const updateQuantity = (id_stock: number, quantite: number) => {
    setCart(cart.map(item =>
      item.id_stock === id_stock
        ? { ...item, quantite, montant: item.prix * quantite }
        : item
    ));
  };

  const updatePrice = (id_stock: number, prix: number) => {
    setCart(cart.map(item =>
      item.id_stock === id_stock
        ? { ...item, prix, montant: prix * item.quantite }
        : item
    ));

    // Save last used price for this product in localStorage
    const stock = stocks.find(s => s.id === id_stock);
    if (stock && stock.produit) {
      const lastPriceKey = `lastPrice_${stock.produit.id}`;
      localStorage.setItem(lastPriceKey, prix.toString());
    }
  };

  const removeFromCart = (id_stock: number) => {
    setCart(cart.filter(item => item.id_stock !== id_stock));
  };

  const total = cart.reduce((sum, item) => sum + item.montant, 0);
  const zeroStockDetails = stocks.filter(stock => (stock.quantiteDisponible ?? 0) === 0);

  const handleSubmit = async () => {
    if (!selectedFournisseur) {
      Swal.fire('Erreur', 'Veuillez sélectionner un fournisseur', 'error');
      return;
    }

    if (cart.length === 0) {
      Swal.fire('Erreur', 'Le panier est vide', 'error');
      return;
    }

    const produitsSelectionnes = cart.map(item => ({
      id_stock: item.id_stock,
      quantite: item.quantite,
      prix: item.prix
    }));

    const payload = {
      reference,
      dateCommande,
      fournisseur: { id: parseInt(selectedFournisseur) },
      produitsSelectionnes,
      total
    };

    try {
      const token = localStorage.getItem('smb_token');
      const url = isEditMode && id ? `http://localhost:8085/api/commandes-fournisseurs/${id}` : 'http://localhost:8085/api/commandes-fournisseurs';
      const method = isEditMode && id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData && errData.error) {
          if (errData.blockedLignes) {
            // blockedLignes can be array of ids or objects
            const blockedLabels: string[] = [];
            errData.blockedLignes.forEach((item: any) => {
              if (typeof item === 'object') {
                blockedLabels.push(item.name ? `${item.name} (stockId: ${item.id})` : `Ligne ${item.id}`);
              } else {
                const id = parseInt(String(item));
                const it = cart.find(c => c.id_stock === id);
                if (it) blockedLabels.push(`${it.nom} (stockId: ${id})`);
                else {
                  const st = stocks.find(s => s.id === id);
                  if (st) blockedLabels.push(`${st.produit?.nomProduit || 'Produit inconnu'} (stockId: ${id})`);
                  else blockedLabels.push(`Ligne ${id}`);
                }
              }
            });
            await Swal.fire('Erreur', `${errData.error}: ${blockedLabels.join(', ')}`, 'error');
          } else {
            await Swal.fire('Erreur', errData.error, 'error');
          }
          return;
        }
        throw new Error(`Erreur lors de la ${isEditMode ? 'modification' : 'création'}`);
      }

      const saved = await res.json().catch(() => ({}));
      Swal.fire('Succès', `Commande ${isEditMode ? 'modifiée' : 'créée'} avec succès`, 'success');
      // In edit mode, validate the response contains saved lignes matching our cart
      if (isEditMode && saved && saved.lignes) {
        const savedStockIds = saved.lignes.map((l: any) => l.stock?.id).filter(Boolean);
        const missing = produitsSelectionnes.filter((ps: any) => !savedStockIds.includes(ps.id_stock));
        if (missing.length > 0) {
          const missingLabels = missing.map((m: any) => {
            const c = cart.find(c => c.id_stock === m.id_stock);
            return c ? `${c.nom} (stockId:${m.id_stock})` : `stockId:${m.id_stock}`;
          });
          Swal.fire('Attention', `Les produits suivants n'ont pas été enregistrés: ${missingLabels.join(', ')}`, 'warning');
        }
      }
      // Reset form
      setCart([]);
      setSelectedFournisseur('');
      generateReference();
      if (isEditMode) {
        // navigate back to listes after edit
        navigate('/liste-commandes');
      }
    } catch (err: any) {
      Swal.fire('Erreur', err.message || 'Erreur inconnue', 'error');
    }
  };

  const openPdfPrint = async (commandeId?: number) => {
    const idToOpen = commandeId || (id ? parseInt(id) : null);
    if (!idToOpen) {
      Swal.fire('Erreur', 'Impossible d\'afficher le PDF : id manquant', 'error');
      return;
    }
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/commandes-fournisseurs/${idToOpen}/pdf`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Impossible de charger le PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      Swal.fire('Erreur', err.message || 'Erreur lors de l\'ouverture du PDF', 'error');
    }
  };

  if (loading) return <div>Chargement...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5>Exécution de la commande fournisseur</h5>
            </div>
            <div className="card-body">
              {/* Breadcrumb */}
              <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
                <div className="breadcrumb-title pe-3">Commande</div>
                <div className="ps-3">
                  <nav aria-label="breadcrumb">
                    <ol className="breadcrumb mb-0 p-0">
                      <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
                      <li className="breadcrumb-item active" aria-current="page">Commande Fournisseur</li>
                    </ol>
                  </nav>
                </div>
                <div className="ms-auto">
                  <div className="btn-group">
                    <button className="btn btn-outline-primary mb-3 mb-lg-0 me-2" onClick={() => navigate('/liste-commandes')}>
                      <i className='bx bx-list-ul'></i> Liste Commande
                    </button>
                    {isEditMode && id && (
                      <button className="btn btn-outline-secondary mb-3 mb-lg-0 me-2" onClick={() => openPdfPrint(parseInt(id))}>
                        <i className='bx bx-printer'></i> Imprimer
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {/* End breadcrumb */}
              <hr />
              <div className="row mb-3">
                <div className="col-md-4">
                  <label>Référence</label>
                  <input type="text" className="form-control" value={reference} readOnly />
                </div>
                <div className="col-md-4">
                  <label>Date et Heure</label>
                  <input type="datetime-local" className="form-control" value={dateCommande} readOnly />
                </div>
                <div className="col-md-4">
                  <label>Fournisseur
                    <button type="button" className="btn btn-sm btn-outline-success ms-2" onClick={() => { setNewFournisseur({}); setFournisseurSearch(''); setShowFournisseurModal(true); }}>
                      <i className='bx bx-plus'></i> Ajouter
                    </button>
                  </label>
                  <select className="form-control" value={selectedFournisseur} onChange={(e) => setSelectedFournisseur(e.target.value)}>
                    <option value="">Sélectionner un fournisseur</option>
                    {fournisseurs.map(f => (
                      <option key={f.id} value={f.id}>{f.prenom} {f.nom}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row">
                <div className="col-md-6">
                  <div className="card">
                    <div className="card-header bg-primary text-white">
                      <h6>Produits disponibles</h6>
                    </div>
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center mb-3" style={{ gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <SearchableSelect
                            options={stocks.map((stock) => ({
                              value: stock.id,
                              label: `${stock.produit?.nomProduit || 'Produit inconnu'} - ${(stock.produit?.prixAchat || 0)} FCFA - ${stock.magasin?.nom || 'Dépôt inconnu'} (Stock: ${stock.quantiteDisponible || 0})`
                              // Note: we intentionally allow selection even when quantiteDisponible is 0
                            }))}
                            value={selectedStockOption}
                            onChange={(val) => {
                              // reflect the choice in the select briefly
                              setSelectedStockOption(val);
                              if (val !== null) {
                                // show an info if the selected stock is out of stock
                                // const st = stocks.find(s => s.id === Number(val));
                                // if (st && (st.quantiteDisponible === 0 || st.quantiteDisponible === undefined)) {
                                //   Swal.fire('Note', 'Ce produit est actuellement en rupture de stock sur ce magasin. Vous pouvez quand même l\'approvisionner.', 'info');
                                // }
                                handleProductSelect(String(val));
                                // reset selection to allow reselecting the same product later
                                setTimeout(() => setSelectedStockOption(null), 0);
                              }
                            }}
                            placeholder="Sélectionner un produit"
                            allowClear={true}
                          />
                        </div>
                        <button 
                          className="btn btn-outline-secondary btn-sm ms-2" 
                          onClick={() => {
                            const keys = Object.keys(localStorage).filter(key => key.startsWith('lastPrice_'));
                            keys.forEach(key => localStorage.removeItem(key));
                            Swal.fire('Succès', 'Historique des prix effacé', 'success');
                          }}
                          title="Effacer l'historique des prix"
                        >
                          <i className="bx bx-refresh"></i>
                        </button>
                      </div>
                      
                      {zeroStockDetails.length > 0 ? (
                        <div className="mt-3">
                          <h6 className="text-muted mb-2">Détails produits en rupture de stock :</h6>
                          <div className="row">
                            {zeroStockDetails.slice(0, 6).map(stock => (
                              <div key={stock.id} className="col-md-6 mb-2">
                                <div className="d-flex justify-content-between align-items-center p-2 border rounded">
                                  <div>
                                    <strong>{stock.produit?.nomProduit || 'Produit inconnu'}</strong>
                                    <br />
                                    <small className="text-muted">{Number(stock.produit?.prixAchat ?? 0)} FCFA</small>
                                  </div>
                                  <div>
                                    <span className="badge bg-primary me-1">{stock.magasin?.nom || 'Dépôt inconnu'}</span>
                                    <span className="badge bg-danger">
                                      Stock: {stock.quantiteDisponible ?? 0}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3">
                          <h6 className="text-muted mb-2">Aucun produit en rupture de stock</h6>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="card">
                    <div className="card-header bg-primary text-white">
                      <h6>Panier</h6>
                    </div>
                    <div className="card-body">
                      <table className="table table-striped">
                        <thead>
                          <tr>
                            <th>Produit</th>
                            <th>Qté</th>
                            <th>Prix</th>
                            <th>Montant</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cart.map(item => (
                            <tr key={item.id_stock}>
                              <td>{item.nom}</td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control"
                                  value={item.quantite}
                                  min="1"
                                  onChange={(e) => updateQuantity(item.id_stock, parseInt(e.target.value) || 1)}
                                />
                              </td>
                              <td>
                                <div className="input-group">
                                  <input
                                    type="number"
                                    className="form-control"
                                    value={item.prix}
                                    min="0"
                                    step="0.01"
                                    onChange={(e) => updatePrice(item.id_stock, parseFloat(e.target.value) || 0)}
                                  />
                                  {(() => {
                                    const stock = stocks.find(s => s.id === item.id_stock);
                                    if (stock && stock.produit) {
                                      const lastPriceKey = `lastPrice_${stock.produit.id}`;
                                      const lastPrice = localStorage.getItem(lastPriceKey);
                                      if (lastPrice && parseFloat(lastPrice) === item.prix) {
                                        return <span className="input-group-text"><i className="bx bx-memory-card text-success" title="Dernier prix utilisé"></i></span>;
                                      }
                                    }
                                    return null;
                                  })()}
                                </div>
                              </td>
                              <td>{item.montant.toFixed(2)} FCFA</td>
                              <td>
                                <button className="btn btn-danger btn-sm" onClick={() => removeFromCart(item.id_stock)}>
                                  <i className="bx bx-trash"></i>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3} className="text-end fw-bold">Total :</td>
                            <td className="fw-bold">{total.toFixed(2)} FCFA</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div className="row mt-3">
                <div className="col-12 text-center">
                  {cart.length > 0 && (
                    <button className="btn btn-primary" onClick={handleSubmit}>
                      {isEditMode ? 'Modifier la commande' : 'Passer la commande'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Fournisseur add/select modal (rendered as a portal to document.body to avoid stacking issues) */}
      {showFournisseurModal && createPortal(
        <div className="modal show d-block" tabIndex={-1} role="dialog" style={{ zIndex: 2000 }}>
          <div className="modal-backdrop fade show" style={{ zIndex: 1999 }}></div>
          <div className="modal-dialog modal-lg modal-dialog-centered" role="document" style={{ zIndex: 2001 }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Ajouter / Sélectionner un fournisseur</h5>
                <button type="button" className="btn-close" onClick={() => setShowFournisseurModal(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Rechercher un fournisseur existant</label>
                    <input className="form-control" value={fournisseurSearch} onChange={(e) => setFournisseurSearch(e.target.value)} placeholder="Tapez un nom ou contact" />
                    <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8 }}>
                      {fournisseurs.filter(f => {
                        if (!fournisseurSearch) return true;
                        const s = fournisseurSearch.toLowerCase();
                        return (f.prenom || '').toLowerCase().includes(s) || (f.nom || '').toLowerCase().includes(s) || (f.contact || '').toLowerCase().includes(s);
                      }).map(f => (
                        <div key={f.id} className="d-flex justify-content-between align-items-center p-2 border-bottom">
                          <div>
                            <strong>{f.prenom} {f.nom}</strong><br />
                            <small className="text-muted">{f.contact}</small>
                          </div>
                          <div>
                            <button className="btn btn-sm btn-outline-primary" onClick={() => { setSelectedFournisseur(String(f.id)); setShowFournisseurModal(false); }}>
                              Sélectionner
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Créer un nouveau fournisseur</label>
                    <div className="mb-2">
                      <input className="form-control" placeholder="Prénom" value={newFournisseur.prenom || ''} onChange={(e) => setNewFournisseur({ ...newFournisseur, prenom: e.target.value })} />
                    </div>
                    <div className="mb-2">
                      <input className="form-control" placeholder="Nom" value={newFournisseur.nom || ''} onChange={(e) => setNewFournisseur({ ...newFournisseur, nom: e.target.value })} />
                    </div>
                    <div className="mb-2">
                      <input className="form-control" placeholder="Contact" value={newFournisseur.contact || ''} onChange={(e) => setNewFournisseur({ ...newFournisseur, contact: e.target.value })} />
                    </div>
                    <div className="mb-2">
                      <input className="form-control" placeholder="Ville" value={newFournisseur.ville || ''} onChange={(e) => setNewFournisseur({ ...newFournisseur, ville: e.target.value })} />
                    </div>

                    <div className="d-flex justify-content-end mt-3">
                      <button className="btn btn-secondary me-2" onClick={() => { setNewFournisseur({}); setFournisseurSearch(''); setShowFournisseurModal(false); }}>Annuler</button>
                      <button className="btn btn-success" onClick={async () => {
                        // Create new fournisseur via API
                        try {
                          const token = localStorage.getItem('smb_token');
                          const payload: any = { prenom: newFournisseur.prenom, nom: newFournisseur.nom, contact: newFournisseur.contact, ville: newFournisseur.ville };
                          const res = await fetch('http://localhost:8085/api/fournisseurs', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify(payload)
                          });
                          if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            throw new Error(err && err.message ? err.message : `Erreur création fournisseur (${res.status})`);
                          }
                          const created = await res.json();
                          // Add to list and select
                          setFournisseurs(prev => [created, ...(prev || [])]);
                          setSelectedFournisseur(String(created.id));
                          setShowFournisseurModal(false);
                        } catch (err: any) {
                          Swal.fire('Erreur', err.message || 'Erreur lors de la création du fournisseur', 'error');
                        }
                      }}>Créer et associer</button>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default CommandeFournisseur;