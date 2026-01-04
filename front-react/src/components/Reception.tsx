import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useUser } from '../contexts/UserContext';
import SearchableSelect from './SearchableSelect';
import { formatServerDate, formatLocalDate } from '../utils/date';

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
  stock: number | null;
  qteCommande: number;
  qteRecue: number;
  receptionActuelle: number;
  quantiteConditionnement?: number | null;
  useConditionnement?: boolean;
  nombreUnitesParConditionnement?: number | null;
  uniteConditionnementLibelle?: string | null;
}

const Reception: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { currentBoutique, permissions, logout } = useUser();
  const normalizedPermissions = Array.isArray(permissions) ? permissions.map(p => p.toUpperCase()) : [];
  // Rely only on explicit permissions for creation/validation
  const canCreateReception = normalizedPermissions.includes('RECEPTION_ECRITURE') || normalizedPermissions.includes('RECEPTION_CREER');
  const [commandes, setCommandes] = useState<CommandeData[]>([]);
  const [selectedCommande, setSelectedCommande] = useState<CommandeData | null>(null);
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Location state (Achat defaults to MAGASIN if any exist)
  const [magasins, setMagasins] = useState<any[]>([]);
  const [locationType, setLocationType] = useState<'BOUTIQUE'|'MAGASIN'>('MAGASIN');
  const [selectedMagasinId, setSelectedMagasinId] = useState<number | null>(null);

  const fetchMagasins = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch('http://localhost:8085/api/magasins', { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        await Swal.fire('Session expirée', 'Votre session est expirée ou non authentifiée. Vous allez être redirigé vers la connexion.', 'warning');
        try { logout(); } catch (e) { /* ignore */ }
        return [];
      }
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
      const token = localStorage.getItem('smb_token');
      const lt = locType || locationType;
      if (lt === 'MAGASIN') {
        const idToUse = magId || selectedMagasinId;
        if (!idToUse) return [];
        const res = await fetch(`http://localhost:8085/api/magasins/${idToUse}/stocks`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) {
          await Swal.fire('Session expirée', 'Votre session est expirée. Vous allez être redirigé vers la connexion.', 'warning');
          try { logout(); } catch (e) {}
          return [];
        }
        if (!res.ok) throw new Error('Impossible de charger les produits du magasin');
        const data = await res.json();
        return data || [];
      } else {
        const res = await fetch('http://localhost:8085/api/stocks', { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) {
          await Swal.fire('Session expirée', 'Votre session est expirée. Vous allez être redirigé vers la connexion.', 'warning');
          try { logout(); } catch (e) {}
          return [];
        }
        if (!res.ok) throw new Error('Impossible de charger les stocks');
        const data = await res.json();
        const boutiqueOnly = (data || []).filter((s: any) => !s.magasin);
        return boutiqueOnly;
      }
    } catch (e: any) {
      Swal.fire('Erreur', e.message || 'Erreur lors du chargement des stocks', 'error');
      return [];
    }
  };
  // Server-side feedback to display after submit
  const [serverError, setServerError] = useState<{ message: string; details?: any } | null>(null);

  // Debug info (temporary) - shows token, userData, and last fetch result
  const [, setDebugInfo] = useState<{ token?: string | null; userData?: any; fetchStatus?: string; fetchResponse?: any }>({ token: null, userData: null, fetchStatus: '', fetchResponse: null });

  // Generate reception reference
  const generateRefReception = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `REC-${dateStr}-${timeStr}`;
  };

  const now = new Date();
  const [refReception] = useState(generateRefReception());
  // Keep an ISO timestamp to send to server
  const [dateReceptionIso] = useState(now.toISOString());

  useEffect(() => {
    console.log('Reception useEffect triggered, currentBoutique:', currentBoutique, 'id:', id);
    const token = localStorage.getItem('smb_token');
    const userData = localStorage.getItem('smb_user_data');
    setDebugInfo(prev => ({ ...prev, token: token ? (token.length > 12 ? token.slice(0,12) + '...' : token) : null, userData: userData ? JSON.parse(userData) : null }));
    if (currentBoutique) {
      (async () => {
        const mags = await fetchMagasins();
        if (mags && mags.length > 0) {
          setLocationType('MAGASIN');
          setSelectedMagasinId(mags[0].id);
        } else {
          setLocationType('BOUTIQUE');
          setSelectedMagasinId(null);
        }

        await fetchCommandes();
        // Si un ID de commande est fourni dans l'URL, la charger automatiquement
        if (id) {
          handleCommandeChange(id);
        }
      })();
    } else {
      console.log('No currentBoutique available, cannot fetch commandes');
      setError('Aucune boutique associée à votre compte. Contactez l\'administrateur.');
    }
  }, [currentBoutique, id]);

  // Listen for paiement cancellation events to refresh commandes and selected commande
  useEffect(() => {
    const handler = (ev: Event) => {
      try {
        // @ts-ignore
        const detail = ev.detail || {};
        const commandeId = detail.commandeId ?? null;
        // Refresh commandes list
        fetchCommandes();
        // If the cancelled paiement affects the currently selected commande, refresh it
        if (selectedCommande && commandeId && Number(selectedCommande.id) === Number(commandeId)) {
          handleCommandeChange(String(commandeId));
        }
      } catch (e) {
        // ignore
      }
    };
    window.addEventListener('paiement:cancelled', handler as EventListener);
    return () => window.removeEventListener('paiement:cancelled', handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCommande]);

  const fetchCommandes = async () => {
    setLoading(true);
    setDebugInfo(prev => ({ ...prev, fetchStatus: 'loading', fetchResponse: null }));
    try {
      const token = localStorage.getItem('smb_token');
      const url = `http://localhost:8085/api/commandes-fournisseurs/a-recevoir`; 
      console.log('Fetching commandes from:', url);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        await Swal.fire('Session expirée', 'Authentification requise. Vous allez être redirigé vers la page de connexion.', 'error');
        try { logout(); } catch (e) {}
        return;
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText || 'Erreur serveur');
        throw new Error(errText || 'Erreur lors du chargement des commandes');
      }
      const data = await res.json();
      console.log('Fetched commandes:', data);
      setCommandes(data);
      setDebugInfo(prev => ({ ...prev, fetchStatus: 'ok', fetchResponse: data }));
    } catch (err: any) {
      const message = err.message || 'Erreur inconnue';
      setError(message);
      setDebugInfo(prev => ({ ...prev, fetchStatus: 'error', fetchResponse: message }));
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
      if (commandeRes.status === 401) {
        await Swal.fire('Session expirée', 'Authentification requise. Vous allez être redirigé vers la page de connexion.', 'error');
        try { logout(); } catch (e) {}
        return;
      }
      if (!commandeRes.ok) throw new Error('Erreur lors du chargement de la commande');
      const commande = await commandeRes.json();
      setSelectedCommande(commande);

      // Fetch articles for this command
      const articlesRes = await fetch(`http://localhost:8085/api/receptions/commande/${commandeId}/articles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (articlesRes.status === 401) {
        await Swal.fire('Session expirée', 'Authentification requise. Vous allez être redirigé vers la page de connexion.', 'error');
        try { logout(); } catch (e) {}
        return;
      }
      if (!articlesRes.ok) throw new Error('Erreur lors du chargement des articles');
      const articles = await articlesRes.json();

      // Ensure stocks for the selected location are loaded so we can show depot and available quantity
      const stocksForLoc = await fetchStocksByLocation();
      const enriched = (articles || []).map((a: any) => {
        const productId = a.idProduit || a.produitId || null;
        const stockInfo = (stocksForLoc || []).find((s: any) => (s.produit && s.produit.id === productId) || s.produitId === productId || s.id_produit === productId);
        const nombreUnitesParConditionnement = stockInfo?.produit?.nombreUnitesParConditionnement ?? a.nombreUnitesParConditionnement ?? null;
        const uniteConditionnementLibelle = stockInfo?.produit?.unite?.libelle ?? a.uniteConditionnementLibelle ?? null;

        // Compute sensible defaults for conditionnement display and reception

        // Only default to conditionnement when the command was actually placed in conditionnement
        // i.e., when quantiteConditionnement is provided OR the ordered quantity is exactly divisible
        const isExactlyDivisible = (nombreUnitesParConditionnement && nombreUnitesParConditionnement > 0 && a.qteCommande % nombreUnitesParConditionnement === 0);
        const commandCondCountExact = isExactlyDivisible ? (a.qteCommande / nombreUnitesParConditionnement) : null;

        const defaultUseConditionnement = (a.quantiteConditionnement !== undefined && a.quantiteConditionnement !== null)
          ? true
          : (commandCondCountExact !== null && commandCondCountExact > 0);

        const defaultQuantiteConditionnement = (a.quantiteConditionnement !== undefined && a.quantiteConditionnement !== null)
          ? a.quantiteConditionnement
          : (defaultUseConditionnement && commandCondCountExact !== null ? commandCondCountExact : null);

        const defaultReceptionActuelle = defaultUseConditionnement && defaultQuantiteConditionnement !== null
          ? (defaultQuantiteConditionnement * (nombreUnitesParConditionnement || 1))
          : 0;

        return {
          ...a,
          depot: a.depot || (stockInfo && stockInfo.magasin ? stockInfo.magasin.nom : (stockInfo && stockInfo.produit ? 'Dépôt inconnu' : null)),
          stock: (a.stock !== undefined && a.stock !== null) ? a.stock : (stockInfo ? stockInfo.quantiteDisponible : null),
          // initialize reception state: prefer conditionnement when the command was placed in cond, otherwise default to 0 received
          useConditionnement: defaultUseConditionnement,
          quantiteConditionnement: defaultQuantiteConditionnement ?? null,
          nombreUnitesParConditionnement: nombreUnitesParConditionnement,
          uniteConditionnementLibelle: uniteConditionnementLibelle,
          receptionActuelle: defaultReceptionActuelle
        } as ArticleData;
      });

      setArticles(enriched);
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
        dateReception: dateReceptionIso,
        dateReceptionTimezoneOffsetMinutes: new Date().getTimezoneOffset(),
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
          receptionActuelle: article.receptionActuelle,
          quantiteConditionnement: article.quantiteConditionnement !== undefined ? article.quantiteConditionnement : null
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

      // Parse and surface server errors (better UX than a generic message)
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        let errMsg = `Erreur serveur (${res.status})`;
        let details: any = null;
        if (contentType.includes('application/json')) {
          const errBody = await res.json().catch(() => null);
          errMsg = (errBody && (errBody.error || errBody.message)) || errMsg;
          details = errBody && errBody.details ? errBody.details : null;
        } else {
          const text = await res.text().catch(() => null);
          if (text) errMsg = text;
        }
        // Persist server error to UI and show modal
        setServerError({ message: errMsg, details });
        await Swal.fire({
          icon: 'error',
          title: 'Erreur',
          html: `<div>${errMsg}</div>${details ? '<pre style="text-align:left">' + JSON.stringify(details, null, 2) + '</pre>' : ''}`
        });
        return;
      }

      // On success, clear any server error and show a simple success modal
      setServerError(null);
      Swal.fire('Succès', 'Réception validée avec succès', 'success');
      
      // Rafraîchir les articles pour voir les quantités mises à jour
      if (selectedCommande) {
        await handleCommandeChange(selectedCommande.id.toString());
      }
    } catch (err: any) {
      const message = err && err.message ? err.message : 'Erreur inconnue';
      setServerError({ message, details: null });
      Swal.fire('Erreur', message, 'error');
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

      {/* Debug panel (temporary) */}
      {/* <div className="card mb-3">
        <div className="card-header bg-secondary text-white">Debug (temp)</div>
        <div className="card-body">
          <div><strong>Token:</strong> {debugInfo.token ? debugInfo.token : <em>none</em>}</div>
          <div style={{marginTop: '8px'}}><strong>currentBoutique:</strong>
            <pre style={{whiteSpace:'pre-wrap', margin:0}}>{JSON.stringify(currentBoutique || debugInfo.userData?.currentBoutique || null, null, 2)}</pre>
          </div>
          <div style={{marginTop: '8px'}}><strong>Fetch status:</strong> {debugInfo.fetchStatus}</div>
          {debugInfo.fetchResponse && <div style={{marginTop: '8px'}}><strong>Fetch response:</strong>
            <pre style={{whiteSpace:'pre-wrap', textAlign:'left', maxHeight: '200px', overflow: 'auto'}}>{JSON.stringify(debugInfo.fetchResponse, null, 2)}</pre>
          </div>}
        </div>
      </div> */}

      {/* Breadcrumb */}
      <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Commande</div>        <div className="breadcrumb-subtitle">Commande Fournisseur</div>        <div className="ps-3">
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

      {/* Server feedback (errors and per-line results) */}
      {serverError && (
        <div className="alert alert-danger" role="alert">
          <div><strong>Erreur serveur :</strong> {serverError.message}</div>
          {serverError.details && <pre style={{ whiteSpace: 'pre-wrap', textAlign: 'left' }}>{JSON.stringify(serverError.details, null, 2)}</pre>}
          <div className="mt-2"><button className="btn btn-sm btn-outline-secondary" onClick={() => setServerError(null)}>Effacer</button></div>
        </div>
      )}


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
                      value={formatLocalDate(dateReceptionIso)}
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
                      value={selectedCommande ? formatServerDate(selectedCommande.dateCommande) : ''}
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

                <div className="form-group mb-3 d-flex align-items-center" style={{ gap: 8 }}>
                  <label className="me-2">Emplacement</label>
                  <select
                    className="form-select form-select-sm me-2"
                    value={locationType === 'MAGASIN' ? `MAGASIN:${selectedMagasinId || ''}` : 'BOUTIQUE'}
                    onChange={async (e) => {
                      const val = e.target.value;
                      if (val.startsWith('MAGASIN:')) {
                        const idVal = Number(val.split(':')[1]);
                        setLocationType('MAGASIN');
                        setSelectedMagasinId(idVal);
                        // refresh articles to reflect new stock info
                        if (selectedCommande) await handleCommandeChange(String((selectedCommande as any).id));
                      } else {
                        setLocationType('BOUTIQUE');
                        setSelectedMagasinId(null);
                        if (selectedCommande) await handleCommandeChange(String((selectedCommande as any).id));
                      }
                    }}
                  >
                    <option value="BOUTIQUE">Dépôt boutique</option>
                    {magasins.map(m => (
                      <option key={m.id} value={`MAGASIN:${m.id}`}>{`Magasin - ${m.nom}`}</option>
                    ))}
                  </select>
                </div>

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
                          <td>
                            {article.nombreUnitesParConditionnement && article.nombreUnitesParConditionnement > 1 ? (
                              (() => {
                                const mul = article.nombreUnitesParConditionnement || 1;
                                const condCount = Math.floor(article.qteCommande / mul);
                                return (
                                  <div>
                                    <div><strong>{condCount} {article.uniteConditionnementLibelle || 'carton'} {article.designation}</strong></div> 
                                    <div><small className="text-muted"># {article.qteCommande} u — 1 {article.uniteConditionnementLibelle ?? 'carton'} = {mul} u</small></div>
                                  </div>
                                );
                              })()
                            ) : (
                              article.designation
                            )}
                          </td>
                          <td>{article.stock}</td>
                          <td>{article.qteCommande}</td>
                          <td>{article.qteRecue}</td>
                          <td>{article.qteCommande - article.qteRecue}</td>
                          <td>
                            {article.nombreUnitesParConditionnement && article.nombreUnitesParConditionnement > 1 ? (
                              <div>
                                <div className="form-check form-switch mb-1">
                                  <input className="form-check-input" type="checkbox" id={`cond_switch_${index}`} checked={!!article.useConditionnement} onChange={e => {
                                    const useCond = e.target.checked;
                                    const newArticles = [...articles];
                                    newArticles[index].useConditionnement = useCond;
                                    const mul = newArticles[index].nombreUnitesParConditionnement || 1;
                                    const remainingUnits = Math.max(0, (newArticles[index].qteCommande || 0) - (newArticles[index].qteRecue || 0));
                                    const condRemaining = mul > 1 ? Math.floor(remainingUnits / mul) : 0;
                                    if (useCond) {
                                      // Prefer existing cond qty, otherwise default to all remaining full conditionnements, or 1
                                      const existing = newArticles[index].quantiteConditionnement;
                                      const defaultQ = (existing !== undefined && existing !== null) ? existing : (condRemaining > 0 ? condRemaining : 1);
                                      newArticles[index].quantiteConditionnement = defaultQ;
                                      // set receptionActuelle in units
                                      newArticles[index].receptionActuelle = (newArticles[index].quantiteConditionnement || 0) * mul;
                                    } else {
                                      // when toggling off, clear cond qty but preserve the equivalent units value so user can switch back and forth
                                      const prevQ = newArticles[index].quantiteConditionnement || 0;
                                      newArticles[index].quantiteConditionnement = null;
                                      newArticles[index].receptionActuelle = prevQ * mul;
                                    }
                                    setArticles(newArticles);
                                  }} />
                                  <label className="form-check-label ms-2" htmlFor={`cond_switch_${index}`}>Par conditionnement</label>
                                </div>
                                {article.useConditionnement ? (
                                  <div className="d-flex align-items-center">
                                    <input type="number" className="form-control me-2" min={0} value={article.quantiteConditionnement ?? 0} onChange={e => {
                                      const q = Math.max(0, parseInt(e.target.value) || 0);
                                      const mul = article.nombreUnitesParConditionnement || 1;
                                      const units = q * mul;
                                      const maxAllowed = article.qteCommande - article.qteRecue;
                                      if (units > maxAllowed) { Swal.fire('Erreur', `La quantité en unités (${units}) dépasse la quantité restante (${maxAllowed})`, 'warning'); return; }
                                      const newArticles = [...articles];
                                      newArticles[index].quantiteConditionnement = q;
                                      newArticles[index].receptionActuelle = units;
                                      setArticles(newArticles);
                                    }} />
                                    <div><small className="text-muted"># {article.qteCommande} u — 1 {article.uniteConditionnementLibelle ?? 'carton'} = {article.nombreUnitesParConditionnement || 1} u</small></div> 
                                  </div>
                                ) : (
                                  <input type="number" className="form-control" value={article.receptionActuelle} onChange={e => {
                                    const newValue = Math.max(0, parseInt(e.target.value) || 0);
                                    const maxAllowed = article.qteCommande - article.qteRecue;
                                    if (newValue > maxAllowed) { Swal.fire('Erreur', `La quantité ne peut pas dépasser ${maxAllowed} (quantité restante)`, 'warning'); return; }
                                    // Update cond qty if perfectly divisible
                                    const mul = article.nombreUnitesParConditionnement || 1;
                                    const newArticles = [...articles];
                                    newArticles[index].receptionActuelle = newValue;
                                    if (mul > 1 && newValue % mul === 0) newArticles[index].quantiteConditionnement = newValue / mul; else newArticles[index].quantiteConditionnement = null;
                                    setArticles(newArticles);
                                  }} min="0" max={article.qteCommande - article.qteRecue} />
                                )}
                              </div>
                            ) : (
                              <input
                                type="number"
                                className="form-control"
                                value={article.receptionActuelle}
                                onChange={(e) => {
                                  const newValue = parseInt(e.target.value) || 0;
                                  const maxAllowed = article.qteCommande - article.qteRecue;
                                  if (newValue > maxAllowed) { Swal.fire('Erreur', `La quantité ne peut pas dépasser ${maxAllowed} (quantité restante)`, 'warning'); return; }
                                  const newArticles = [...articles];
                                  newArticles[index].receptionActuelle = newValue;
                                  setArticles(newArticles);
                                }}
                                min="0"
                                max={article.qteCommande - article.qteRecue}
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="row mt-4">
                  <div className="col-12">
                    {canCreateReception ? (
                      <button
                        id="valider-btn"
                        name="valider"
                        className="btn btn-primary float-end"
                        type="submit"
                        style={{ display: articles.length > 0 ? 'block' : 'none' }}
                      >
                        Valider
                      </button>
                    ) : (
                      <div className="text-muted float-end" style={{ display: articles.length > 0 ? 'block' : 'none' }}>Vous n'avez pas la permission de valider cette réception</div>
                    )}
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