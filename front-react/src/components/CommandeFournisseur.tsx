import React, { useEffect, useState } from 'react';
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
  const [reference, setReference] = useState('');
  const [dateCommande, setDateCommande] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStocks();
    fetchFournisseurs();
    generateReference();
    setDateCommande(new Date().toISOString().slice(0, 16));
  }, []);

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
      const defaultPrice = lastPrice ? parseFloat(lastPrice) : (stock.produit?.prixAchat || 0);

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
      const res = await fetch('http://localhost:8085/api/commandes-fournisseurs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Erreur lors de la création de la commande');
      }

      Swal.fire('Succès', 'Commande créée avec succès', 'success');
      // Reset form
      setCart([]);
      setSelectedFournisseur('');
      generateReference();
    } catch (err: any) {
      Swal.fire('Erreur', err.message || 'Erreur inconnue', 'error');
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
                  <label>Fournisseur</label>
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
                    <div className="card-header bg-info text-white">
                      <h6>Produits disponibles</h6>
                    </div>
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <select className="form-control" onChange={(e) => { handleProductSelect(e.target.value); e.target.value = ''; }}>
                          <option value="">Sélectionner un produit</option>
                        {stocks.map(stock => (
                          <option key={stock.id} value={stock.id}>
                            {stock.produit?.nomProduit || 'Produit inconnu'} - {(stock.produit?.prixAchat || 0)} FCFA - {stock.magasin?.nom || 'Dépôt inconnu'} (Stock: {stock.quantiteDisponible || 0})
                          </option>
                        ))}
                        </select>
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
                      
                      {stocks.length > 0 && (
                        <div className="mt-3">
                          <h6 className="text-muted mb-2">Détails des produits disponibles :</h6>
                          <div className="row">
                            {stocks.slice(0, 6).map(stock => (
                              <div key={stock.id} className="col-md-6 mb-2">
                                <div className="d-flex justify-content-between align-items-center p-2 border rounded">
                                  <div>
                                    <strong>{stock.produit?.nomProduit || 'Produit inconnu'}</strong>
                                    <br />
                                    <small className="text-muted">{(stock.produit?.prixAchat || 0)} FCFA</small>
                                  </div>
                                  <div>
                                    <span className="badge bg-primary me-1">{stock.magasin?.nom || 'Dépôt inconnu'}</span>
                                    <span className={`badge ${
                                      (stock.quantiteDisponible || 0) > 20 ? 'bg-success' : 
                                      (stock.quantiteDisponible || 0) > 5 ? 'bg-warning' : 
                                      'bg-danger'
                                    }`}>
                                      Stock: {stock.quantiteDisponible || 0}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
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
                      Passer la commande
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandeFournisseur;