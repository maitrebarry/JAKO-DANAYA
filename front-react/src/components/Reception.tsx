import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useUser } from '../contexts/UserContext';
import SearchableSelect from './SearchableSelect';

interface CommandeData {
  id: number;
  reference: string;
  dateCommande: string;
  fournisseur: {
    id: number;
    prenom: string;
    nom: string;
  };
  total: number;
  pourcentageRecu: number;
  pourcentagePaye: number;
  montantPaye: number;
}

interface ArticleData {
  id: number;
  idProduit: number;
  designation: string;
  depot: string;
  stock: number;
  qteCommande: number;
  qteRecue: number;
  receptionActuelle: number;
}

const Reception: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { currentBoutique } = useUser();
  const [commandes, setCommandes] = useState<CommandeData[]>([]);
  const [selectedCommande, setSelectedCommande] = useState<CommandeData | null>(null);
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Generate reception reference
  const generateRefReception = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    return `REC-${dateStr}-${timeStr}`;
  };

  const [refReception] = useState(generateRefReception());
  const [dateReception] = useState(new Date().toLocaleString('fr-FR'));

  useEffect(() => {
    console.log('Reception useEffect triggered, currentBoutique:', currentBoutique, 'id:', id);
    if (currentBoutique) {
      fetchCommandes().then(() => {
        // Si un ID de commande est fourni dans l'URL, la charger automatiquement
        if (id) {
          handleCommandeChange(id);
        }
      });
    } else {
      console.log('No currentBoutique available, cannot fetch commandes');
      setError('Aucune boutique associée à votre compte. Contactez l\'administrateur.');
    }
  }, [currentBoutique, id]);

  const fetchCommandes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('smb_token');
      const url = `http://localhost:8085/api/commandes-fournisseurs/a-recevoir`;
      console.log('Fetching commandes from:', url);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors du chargement des commandes');
      const data = await res.json();
      console.log('Fetched commandes:', data);
      setCommandes(data);
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const handleCommandeChange = async (commandeId: string) => {
    if (!commandeId) {
      setSelectedCommande(null);
      setArticles([]);
      return;
    }

    try {
      const token = localStorage.getItem('smb_token');
      
      // Fetch command details
      const commandeRes = await fetch(`http://localhost:8085/api/commandes-fournisseurs/${commandeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!commandeRes.ok) throw new Error('Erreur lors du chargement de la commande');
      const commande = await commandeRes.json();
      setSelectedCommande(commande);

      // Fetch articles for this command
      const articlesRes = await fetch(`http://localhost:8085/api/receptions/commande/${commandeId}/articles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!articlesRes.ok) throw new Error('Erreur lors du chargement des articles');
      const articles = await articlesRes.json();
      setArticles(articles);
    } catch (err: any) {
      Swal.fire('Erreur', err.message || 'Erreur inconnue', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommande) return;

    try {
      const token = localStorage.getItem('smb_token');
      const receptionData = {
        reference: refReception,
        dateReception: dateReception,
        idCommandeFournisseur: selectedCommande.id,
        referenceCommande: selectedCommande.reference,
        fournisseur: `${selectedCommande.fournisseur.prenom} ${selectedCommande.fournisseur.nom}`,
        idBoutique: currentBoutique?.id,
        lignesReception: articles.map(article => ({
          idProduit: article.idProduit,
          designation: article.designation,
          depot: article.depot,
          stock: article.stock,
          qteCommande: article.qteCommande,
          qteRecue: article.qteRecue,
          receptionActuelle: article.receptionActuelle
        }))
      };

      const res = await fetch('http://localhost:8085/api/receptions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(receptionData)
      });

      if (!res.ok) throw new Error('Erreur lors de la validation de la réception');

      Swal.fire('Succès', 'Réception validée avec succès', 'success');
      
      // Rafraîchir les articles pour voir les quantités mises à jour
      if (selectedCommande) {
        await handleCommandeChange(selectedCommande.id.toString());
      }
    } catch (err: any) {
      Swal.fire('Erreur', err.message || 'Erreur inconnue', 'error');
    }
  };

  if (error) {
    return (
      <div className="container-fluid" style={{ minHeight: '100vh', backgroundColor: '#fff', padding: '20px' }}>
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  return (
    <div className="container-fluid reception-page">
      {loading && (
        <div className="d-flex justify-content-center align-items-center" style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          backgroundColor: 'rgba(255, 255, 255, 0.8)', 
          zIndex: 9999 
        }}>
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Chargement...</span>
            </div>
            <div>Chargement des données...</div>
          </div>
        </div>
      )}
      {/* Breadcrumb */}
      <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Commande</div>
        <div className="ps-3">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 p-0">
              <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
              <li className="breadcrumb-item active" aria-current="page">réception</li>
            </ol>
          </nav>
        </div>
        <div className="ms-auto">
          <div className="btn-group">
            <button
              className="btn btn-primary mb-3 mb-lg-0"
              onClick={() => navigate('/liste-commandes')}
            >
              Liste des commandes
            </button>
          </div>
        </div>
      </div>
      {/* End breadcrumb */}
      <hr />

      <form onSubmit={handleSubmit} className="row" noValidate>
        <div className="row">
          {/* Informations principales */}
          <div className="col-xl-12">
            <div className="card">
              <div className="card-header bg-primary text-white">
                Référence de la commande et de la réception
              </div>
              <div className="card-body">
                <div className="row mb-4">
                  <div className="col-md-2">
                    <label htmlFor="date_reception" className="form-label">
                      Date de réception <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      name="date_reception"
                      className="form-control"
                      id="date_reception"
                      value={dateReception}
                      readOnly
                    />
                  </div>
                  <div className="col-md-2">
                    <label htmlFor="ref_reception" className="form-label">
                      Réf réception <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      name="ref_reception"
                      className="form-control"
                      id="ref_reception"
                      value={refReception}
                      readOnly
                    />
                  </div>
                  <div className="col-md-2">
                    <label htmlFor="ref_commande" className="form-label">
                      Réf Commande <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      name="reference"
                      id="ref_commande"
                      value={selectedCommande?.reference || ''}
                      readOnly
                    />
                  </div>
                  <div className="col-md-3">
                    <label htmlFor="date_commande" className="form-label">
                      Date commande <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      name="date_commande"
                      id="date_commande"
                      value={selectedCommande ? new Date(selectedCommande.dateCommande).toLocaleString('fr-FR') : ''}
                      readOnly
                    />
                  </div>
                  <div className="col-md-3">
                    <label htmlFor="id_fournisseur" className="form-label">
                      Fournisseur <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      name="fournisseur"
                      className="form-control"
                      id="id_fournisseur"
                      value={selectedCommande?.fournisseur ? `${selectedCommande.fournisseur.prenom} ${selectedCommande.fournisseur.nom}` : ''}
                      readOnly
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Articles sélectionnés */}
          <div className="col-xl-12">
            <div className="card">
              <div className="card-header bg-primary text-white">
                Articles sélectionnés
              </div>
              <div className="card-body">
                <div className="form-group mb-4">
                  <label htmlFor="commande_select">Sélectionnez une commande :</label>
                  <SearchableSelect
                    options={(commandes || []).map(cmd => ({ value: cmd.id, label: `${cmd.reference} - ${cmd.pourcentageRecu.toFixed(1)}% reçu` }))}
                    value={selectedCommande?.id ?? null}
                    onChange={(val) => handleCommandeChange(String(val || ''))}
                    placeholder="Rechercher par référence..."
                  />
                </div>
                <hr className="mt-5" />
                <div className="table-responsive">
                  <table id="articles_table" className="table table-striped table-bordered">
                    <thead>
                      <tr>
                        <th>DÉPÔT</th>
                        <th>DESIGNATION</th>
                        <th>STOCK</th>
                        <th>QTE COMMANDE</th>
                        <th>QTE RECUE</th>
                        <th>QTE RESTANTE</th>
                        <th>RECEPTION ACTUELLE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {articles.map((article, index) => (
                        <tr key={article.id || index}>
                          <td>
                            <span className="badge bg-info text-white">{article.depot}</span>
                          </td>
                          <td>{article.designation}</td>
                          <td>{article.stock}</td>
                          <td>{article.qteCommande}</td>
                          <td>{article.qteRecue}</td>
                          <td>{article.qteCommande - article.qteRecue}</td>
                          <td>
                            <input
                              type="number"
                              className="form-control"
                              value={article.receptionActuelle}
                              onChange={(e) => {
                                const newValue = parseInt(e.target.value) || 0;
                                const maxAllowed = article.qteCommande - article.qteRecue;
                                
                                // Validation : ne pas dépasser la quantité restante
                                if (newValue > maxAllowed) {
                                  Swal.fire('Erreur', `La quantité ne peut pas dépasser ${maxAllowed} (quantité restante)`, 'warning');
                                  return;
                                }
                                
                                const newArticles = [...articles];
                                newArticles[index].receptionActuelle = newValue;
                                setArticles(newArticles);
                              }}
                              min="0"
                              max={article.qteCommande - article.qteRecue}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="row mt-4">
                  <div className="col-12">
                    <button
                      id="valider-btn"
                      name="valider"
                      className="btn btn-primary float-end"
                      type="submit"
                      style={{ display: articles.length > 0 ? 'block' : 'none' }}
                    >
                      Valider
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Reception;