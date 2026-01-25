import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { formatServerDate, formatLocalDate } from '../utils/date';
import { API, withApi } from '../config/api';

interface VenteLine {
  id?: number; // id de la ligne si disponible
  id_stock?: number;
  produit?: any;
  designation?: string;
  // différents noms renvoyés par l'API pour la quantité
  quantite?: number;
  quantiteCommande?: number;
  quantiteLivre?: number;
  qte_livre?: number;
  quantiteLivreeNow?: number;
  // conditionnement support
  quantiteConditionnement?: number;
  // Informations dépôt et stock (comme pour la réception)
  depot?: string;
  stock?: number;
  // ids de secours selon différents formats d'API
  productId?: number;
  produitId?: number;
}

const VenteLivraison: React.FC = () => {
  const [searchParams] = useSearchParams();
  const venteId = searchParams.get('venteId');
  const navigate = useNavigate();

  const [vente, setVente] = useState<any>(null);
  const [lignes, setLignes] = useState<VenteLine[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isClientCommande, setIsClientCommande] = useState(false);

  // Location state
  const [_magasins, setMagasins] = useState<any[]>([]);
  const [locationType, setLocationType] = useState<'BOUTIQUE'|'MAGASIN'>('BOUTIQUE');
  const [selectedMagasinId, setSelectedMagasinId] = useState<number | null>(null);

  const getAuthToken = (): string | null => {
    const raw = localStorage.getItem('smb_token');
    if (!raw) return null;
    try {
      const trimmed = raw.trim();
      if (trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed);
        // noms de champs courants pour le token
        return parsed?.token || parsed?.accessToken || parsed?.jwt || parsed?.authToken || null;
      }
    } catch (e) {
      // pas du JSON, continuer
    }
    if (raw.startsWith('Bearer ')) return raw.slice('Bearer '.length);
    return raw;
  };

  const fetchMagasins = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch(withApi('magasins'), { headers: { Authorization: token ? `Bearer ${token}` : '' } });
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
        const res = await fetch(withApi(`magasins/${idToUse}/stocks`), { headers: { Authorization: token ? `Bearer ${token}` : '' } });
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

  // Pour sélectionner une vente à livrer (reprend le comportement de la réception pour sélectionner une commande fournisseur)
  const [ventes, setVentes] = useState<any[]>([]);
  const [selectedVenteId, setSelectedVenteId] = useState<string | null>(venteId);

  // Référence et date de livraison (similaire à réception)
  const generateRefLivraison = () => `LV-${new Date().toISOString().replace(/[:.]/g,'').slice(0,15)}`;
  const [refLivraison] = useState(generateRefLivraison());
  const [dateLivraisonIso] = useState(new Date().toISOString());
  const [serverError, setServerError] = useState<{ message: string; details?: any } | null>(null);



  useEffect(() => {
    (async () => {
      await fetchMagasins();
      // Vente livraison defaults to boutique
      setLocationType('BOUTIQUE');
      setSelectedMagasinId(null);
      await fetchStocksByLocation('BOUTIQUE');
      // Toujours charger la liste des ventes/commandes à livrer pour peupler le select
      await fetchVentesToDeliver();
      // Si un param venteId est fourni, sélectionner et charger ses lignes
      if (venteId) {
        setSelectedVenteId(venteId);
        fetchVenteAndLines(venteId);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venteId]);



  const fetchVentesToDeliver = async () => {
    try {
      const token = getAuthToken();
      // S'assurer que les stocks sont chargés en premier pour enrichir les lignes
      if (!stocks || stocks.length === 0) await fetchStocksByLocation('BOUTIQUE');

      const [resV, resC] = await Promise.all([
        fetch(`${API}/ventes`, { headers: { Authorization: token ? `Bearer ${token}` : '' } }),
        // Envoyer aussi l'en-tête Authorization pour commandes-clients afin d'obtenir la liste correcte
        fetch(`${API}/commandes-clients`, { headers: { Authorization: token ? `Bearer ${token}` : '' } })
      ]);

      console.debug('fetchVentesToDeliver: response statuses', { ventesStatus: resV.status, commandesStatus: resC.status });

      // Si le serveur renvoie 403, informer l'utilisateur (auth manquante ou permissions insuffisantes)
      if (resV.status === 403 || resC.status === 403) {
        Swal.fire('Erreur', 'Accès refusé (403) lors de la récupération des ventes/commandes. Veuillez vous reconnecter ou vérifier vos permissions.', 'error');
        return;
      }

      const ventesData = resV.ok ? await resV.json() : [];
      const commandesData = resC.ok ? await resC.json() : [];

      // S'assurer que chaque vente contient ses lignes : si /api/ventes n'en fournit pas, récupérer les lignes pour chaque vente
      const ventesWithLines = await Promise.all((ventesData || []).map(async (v: any) => {
        if (Array.isArray(v.lignes) && v.lignes.length > 0) return v;
        try {
          const lres = await fetch(`${API}/ventes/${v.id}/lignes`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
          if (lres.ok) {
            const lines = await lres.json();
            return { ...v, lignes: lines };
          }
          const lres2 = await fetch(`${API}/ventes/${v.id}/articles`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
          if (lres2.ok) {
            const lines2 = await lres2.json();
            return { ...v, lignes: lines2 };
          }
        } catch (e) {
          console.debug('fetchVentesToDeliver: could not fetch lines for vente', { id: v.id, err: e });
        }
        return v;
      }));

      // Normaliser et filtrer les ventes qui ont encore des quantités à livrer
      const vFiltered = (ventesWithLines || []).map((v: any) => ({ ...v, type: 'vente' })).filter((v: any) => (v.lignes || []).some((l: any) => ((l.quantite || l.quantiteCommande || 0) > (l.quantiteLivre || l.qte_livre || 0))));

      // Pour commandes-clients : essayer d'abord l'endpoint dédié (/a-livrer), sinon utiliser la liste et s'assurer que chaque commande a ses lignes
      let commandesList: any[] = [];
      try {
        const tryRes = await fetch(`${API}/commandes-clients/a-livrer`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (tryRes.ok) {
          commandesList = await tryRes.json();
          console.debug('fetchVentesToDeliver: used /commandes-clients/a-livrer');
        } else {
          commandesList = commandesData;
        }
      } catch (e) {
        commandesList = commandesData;
      }

      // S'assurer que les commandes ont des lignes (certains endpoints de liste peuvent les omettre)
      const commandesWithLines = await Promise.all((commandesList || []).map(async (c: any) => {
        if (Array.isArray(c.lignes) && c.lignes.length > 0) return c;
        try {
          const detailRes = await fetch(`${API}/commandes-clients/${c.id}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            return { ...c, lignes: detail.lignes || detail.ligne_commande_client || [] };
          }
        } catch (e) {
          console.debug('fetchVentesToDeliver: could not fetch lines for commande-client', { id: c.id, err: e });
        }
        return c;
      }));

      const cNormalized = (commandesWithLines || []).map((c: any) => {
        const totalQ = (c.lignes || []).reduce((acc: number, ln: any) => acc + (ln.quantite || ln.quantiteCommande || 0), 0);
        const totalReceived = (c.lignes || []).reduce((acc: number, ln: any) => acc + (ln.quantiteLivre || ln.qte_livre || 0), 0);
        const pourcentage = totalQ > 0 ? (totalReceived / totalQ) * 100 : 0;
        return {
          ...c,
          type: 'commande-client',
          pourcentageRecu: pourcentage,
          // expose server field name as alias for UI
          date_cmd_client: c.date_cmd_client || c.dateCommande || c.date || null
        };
      });

      const cFiltered = cNormalized.filter((c: any) => (c.lignes || []).some((l: any) => ((l.quantite || l.quantiteCommande || 0) > (l.quantiteLivre || l.qte_livre || 0))));

      const combined = [...vFiltered, ...cFiltered];

      // Infos debug pour vérifier la structure des données
      console.debug('fetchVentesToDeliver', { ventesCount: vFiltered.length, commandesCount: cFiltered.length, combinedCount: combined.length });

      setVentes(combined);
      if (combined.length === 1) {
        setSelectedVenteId(String(combined[0].id));
        if (combined[0].type === 'commande-client') fetchCommandeClientAndLines(String(combined[0].id)); else fetchVenteAndLines(String(combined[0].id));
      }
    } catch (e: any) {
      Swal.fire('Erreur', e.message || 'Erreur lors du chargement des ventes/commandes', 'error');
    }
  };

  const handleSelectVente = (id: string | null) => {
    setSelectedVenteId(id);
    if (!id) {
      setVente(null);
      setLignes([]);
      return;
    }
    const found = (ventes || []).find(v => String(v.id) === String(id));
    if (found) setVente(found);
    // If the selected item is a commande-client, fetch using the commande-client endpoint to ensure we get date_cmd_client and ligne_commande_client structure
    if (found && found.type === 'commande-client') {
      fetchCommandeClientAndLines(id);
    } else {
      fetchVenteAndLines(id);
    }
  };





  const fetchVenteAndLines = async (id: string) => {
    setLoading(true);
    try {
      const token = getAuthToken();

      // Tenter d'abord de charger comme une Vente
      let isClientCommande = false;
      let data: any = null;
      try {
        const res = await fetch(`${API}/ventes/${id}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (res.ok) {
          data = await res.json();
          setVente(data);
        } else {
          // Essayer comme commande-client
          const ccRes = await fetch(`${API}/commandes-clients/${id}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
          if (ccRes.ok) {
            data = await ccRes.json();
            // mark that we are working with a commande client
            isClientCommande = true;
            setVente(data);
          } else {
            throw new Error('Impossible de charger la vente');
          }
        }
      } catch (e) {
        throw e;
      }

      // Récupérer les lignes
      let lines: any[] = [];

      if (isClientCommande) {
        // Si c'est une commande-client, utiliser data.lignes fourni par l'endpoint commande (ligne_commande_client)
        console.debug('fetchVenteAndLines: detected commande-client, using data.lignes', { id, data });
        lines = (data.lignes || []).map((l: any) => ({
          id: l.id,
          produit: l.produit || null,
          productId: l.produit?.id || l.id_produit || l.idProduit || null,
          designation: l.produit?.nomProduit || l.designation || '',
          quantite: l.quantite,
          quantiteLivre: l.quantiteLivre || l.qte_livre || 0,
          id_stock: l.stockId || l.id_stock || null,
          depot: l.depot || null,
          stock: l.stock !== undefined ? l.stock : null
        }));
      } else {
        try {
          const lres = await fetch(`${API}/ventes/${id}/lignes`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
          if (lres.ok) lines = await lres.json();
        } catch (e) {
          console.debug('fetchVenteAndLines: /ventes/{id}/lignes not available or error', { id, err: e });
        }
        if (!lines || lines.length === 0) {
          try {
            const lres2 = await fetch(`${API}/ventes/${id}/articles`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
            if (lres2.ok) lines = await lres2.json();
          } catch (e) {
            console.debug('fetchVenteAndLines: /ventes/{id}/articles not available or error', { id, err: e });
          }
        }
      }

      // Transformer en VenteLine (inclut les champs dépôt/stock éventuels fournis par le serveur)
      const mapped: VenteLine[] = (lines || []).map((l: any) => {
        const qCommande = l.quantite || l.quantiteCommande || 0;
        const qLivre = l.quantiteLivre || l.qte_livre || 0;
        const qRemaining = Math.max(qCommande - qLivre, 0);
        return ({
          id: l.id || l.ligneId || null,
          id_stock: l.stockId || l.id_stock || l.id_stock || null,
          produit: l.produit || null,
          designation: l.designation || (l.produit && l.produit.nomProduit) || 'Produit',
          quantiteCommande: qCommande,
          quantiteLivre: qLivre,
          quantiteLivreeNow: qRemaining,
          depot: l.depot || null,
          stock: (l.stock !== undefined && l.stock !== null) ? l.stock : null
        });
      });

      // Enrichir chaque ligne avec les informations stock/dépôt (comme dans la réception)
      const enriched = mapped.map((base) => {
        // Déterminer l'id produit de façon robuste (depuis produit ou champs productId)
        const productId = base.produit?.id || (base as any).productId || base.produitId || null;

        // Si pas d'id de stock explicite, essayer de le trouver via l'id produit ou en comparant stock.produit
        if (!base.id_stock && productId) {
          const found = (stocks || []).find((s: any) => (s.produit && s.produit.id === productId) || s.id_produit === productId || s.produitId === productId || s.idProduit === productId);
          if (found) base.id_stock = found.id;
        }

        let stockInfo = (stocks || []).find((s: any) => s.id === base.id_stock) || null;

        // Repli : si aucun stock global trouvé, utiliser produit.stocks (fourni dans le payload commande)
        if (!stockInfo && base.produit && Array.isArray(base.produit.stocks) && base.produit.stocks.length > 0) {
          const ps = base.produit.stocks[0];
          stockInfo = { id: ps.id, quantiteDisponible: ps.quantiteDisponible, produit: base.produit, magasin: ps.magasin || null };
          if (!base.id_stock) base.id_stock = ps.id;
          console.debug('enrich ligne: using produit.stocks fallback', { baseId: base.id, produitStock: ps });
        }

        // Lignes de debug pour vérifier le mapping pendant les tests
        console.debug('enrich ligne', { baseId: base.id, productId, baseIdStock: base.id_stock, foundStock: stockInfo });

        base.depot = base.depot || (stockInfo && stockInfo.magasin ? stockInfo.magasin.nom : (stockInfo && (stockInfo.produit || stockInfo.id_produit) ? 'Dépôt inconnu' : null));
        base.stock = (base.stock !== undefined && base.stock !== null) ? base.stock : (stockInfo ? stockInfo.quantiteDisponible : null);
        return base;
      });

      // Pré-remplir la suggestion de livraison en unités lorsque la commande a une fraction de carton
      try {
        enriched.forEach((l) => {
          const stockInfo = (stocks || []).find(s => s.id === l.id_stock);
          const multiplicateur = stockInfo?.produit?.nombreUnitesParConditionnement ?? 1;
          const qCommande = l.quantiteCommande || 0;
          const condFromField = (l as any).quantiteConditionnement && (l as any).quantiteConditionnement > 0 ? (l as any).quantiteConditionnement : Math.floor(qCommande / multiplicateur);
          const remainder = qCommande - (condFromField * multiplicateur);
          (l as any).quantiteLivreeNow = remainder > 0 ? remainder : 0;
        });
      } catch (e) { /* ignore */ }
      setLignes(enriched);
      // Ajouter un indicateur dans l'état pour savoir comment poster les livraisons (vente ou commande-client)
      setIsClientCommande(isClientCommande);
    } catch (e: any) {
      Swal.fire('Erreur', e.message || 'Erreur', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeLine = (index: number, field: keyof VenteLine, value: any) => {
    const copy = [...lignes];
    (copy[index] as any)[field] = value;
    setLignes(copy);
  };

  const fetchCommandeClientAndLines = async (id: string) => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API}/commandes-clients/${id}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) throw new Error('Impossible de charger la commande-client');
      const data = await res.json();
      setVente(data);
      setIsClientCommande(true);

      // Map lines from ligne_commande_client structure
      const lines = (data.lignes || []).map((l: any) => ({ id: l.id, produit: l.produit, designation: l.produit?.nomProduit || l.designation || '', quantite: l.quantite, quantiteLivre: l.quantiteLivre || 0, id_stock: l.stockId || l.id_stock || null, depot: l.depot || null, stock: l.stock !== undefined ? l.stock : null }));

      const mapped: VenteLine[] = (lines || []).map((l: any) => {
        const qCommande = l.quantite || l.quantiteCommande || 0;
        const qLivre = l.quantiteLivre || l.qte_livre || 0;
        const qRemaining = Math.max(qCommande - qLivre, 0);
        return ({
          id: l.id || l.ligneId || null,
          id_stock: l.stockId || l.id_stock || null,
          produit: l.produit || null,
          designation: l.designation || (l.produit && l.produit.nomProduit) || 'Produit',
          quantiteCommande: qCommande,
          quantiteLivre: qLivre,
          quantiteLivreeNow: qRemaining,
          depot: l.depot || null,
          stock: (l.stock !== undefined && l.stock !== null) ? l.stock : null
        });
      });

      const enriched = mapped.map((base) => {
        if (!base.id_stock && base.produit && base.produit.id) {
          const found = (stocks || []).find((s: any) => s.produit && s.produit.id === base.produit.id);
          if (found) base.id_stock = found.id;
        }
        let stockInfo = (stocks || []).find((s: any) => s.id === base.id_stock) || null;
        // Repli vers produit.stocks si le serveur retourne des informations de stock au niveau du produit
        if (!stockInfo && base.produit && Array.isArray(base.produit.stocks) && base.produit.stocks.length > 0) {
          const ps = base.produit.stocks[0];
          stockInfo = { id: ps.id, quantiteDisponible: ps.quantiteDisponible, produit: base.produit, magasin: ps.magasin || null };
          if (!base.id_stock) base.id_stock = ps.id;
          console.debug('enrich commande ligne: using produit.stocks fallback', { baseId: base.id, produitStock: ps });
        }
        base.depot = base.depot || (stockInfo && stockInfo.magasin ? stockInfo.magasin.nom : (stockInfo && stockInfo.produit ? 'Dépôt inconnu' : null));
        base.stock = (base.stock !== undefined && base.stock !== null) ? base.stock : (stockInfo ? stockInfo.quantiteDisponible : null);
        return base;
      });

      setLignes(enriched);
    } catch (e: any) {
      Swal.fire('Erreur', e.message || 'Erreur', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = selectedVenteId || venteId;
    if (!targetId) {
      Swal.fire('Erreur', 'Aucun identifiant de vente sélectionné', 'warning');
      return;
    }

    try {
      const token = getAuthToken();
      if (!token) {
        Swal.fire('Erreur', 'Vous devez être connecté pour effectuer une livraison', 'error');
        return;
      }
      // Construire le payload attendu par le backend : { ligneCommandeId, stockId, quantite }
      // Construire le payload des lignes tel qu'attendu par le backend
      const lignesToSend = lignes.map((l) => {
        const baseQty = l.quantiteLivreeNow ?? l.quantiteLivre ?? l.qte_livre ?? l.quantite ?? 0;
        return { ligneCommandeId: l.id, stockId: l.id_stock, quantite: baseQty };
      }).filter(l => ((l.quantite && l.quantite > 0)));

      // debug: afficher le payload de livraison
      console.debug('lignesToSend payload', lignesToSend);

      if (!lignesToSend.length) {
        Swal.fire('Erreur', 'Aucune quantité à livrer renseignée', 'warning');
        return;
      }

      // Valider quantités demandées vs restantes et disponibilité du stock
      for (const item of lignesToSend) {
        const original = lignes.find(x => (x.id === item.ligneCommandeId));
        const remaining = (original?.quantiteCommande || 0) - (original?.quantiteLivre || 0);
        const stockInfo = item.stockId ? stocks.find(s => s.id === item.stockId) : undefined;

        // compute real quantity in UNITS (always provided as units from the UI)
        const realQty = Number(item.quantite || 0);

        if (realQty > remaining) {
          Swal.fire('Erreur', `Quantité demandée (${realQty}) supérieure à la quantité restante (${remaining}) pour la ligne ${original?.designation || original?.id}` , 'warning');
          return;
        }
        if (item.stockId) {
          if (stockInfo && realQty > (stockInfo.quantiteDisponible || 0)) {
            Swal.fire('Erreur', `Stock insuffisant (${stockInfo.quantiteDisponible}) pour la ligne ${original?.designation || original?.id}`, 'warning');
            return;
          }
        }
      }

      const payload: any = {
        reference: refLivraison,
        dateLivraison: dateLivraisonIso,
        idVente: isClientCommande ? undefined : Number(targetId),
        idCommandeClient: isClientCommande ? Number(targetId) : undefined,
        lignes: lignesToSend
      };

      const endpoint = isClientCommande ? `${API}/commandes-clients/${targetId}/livraisons` : `${API}/ventes/${targetId}/livraisons`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify(payload)
      });

      // Gestion explicite du 403 pour donner un message utile
      if (res.status === 403) {
        const txt = await res.text().catch(() => null);
        const permission = 'LIVRAISON_ECRITURE';
        const errMsg = txt || `Accès refusé (403). Permission requise : ${permission}. Vérifiez vos permissions ou reconnectez-vous.`;
        setServerError({ message: errMsg });
        await Swal.fire('Erreur', errMsg, 'error');
        return;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        let errMsg = `Erreur serveur (${res.status})`;
        let details: any = null;
        if (contentType.includes('application/json')) {
          const body = await res.json().catch(() => null);
          errMsg = body && (body.error || body.message) ? (body.error || body.message) : errMsg;
          details = body && body.details ? body.details : null;
        } else {
          const txt = await res.text().catch(() => null);
          if (txt) errMsg = txt;
        }
        setServerError({ message: errMsg, details });
        await Swal.fire('Erreur', `${errMsg}${details ? '<br/><pre>' + JSON.stringify(details) + '</pre>' : ''}`, 'error');
        return;
      }

      setServerError(null);
      Swal.fire('Succès', 'Livraison enregistrée', 'success');
      // refresh vente or commande to reflect delivered quantities
      fetchVenteAndLines(String(targetId));
      // refresh list of ventes/commandes to remove fully delivered ones
      fetchVentesToDeliver();
    } catch (e: any) {
      setServerError({ message: e.message || 'Erreur inconnue' });
      Swal.fire('Erreur', e.message || 'Erreur inconnue', 'error');
    }
  };

  if (loading) return <div>Chargement...</div>

  return (
    <div className="container-fluid reception-page">
      {loading && (
        <div className="d-flex justify-content-center align-items-center" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.8)', zIndex: 9999 }}>
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" role="status"><span className="visually-hidden">Chargement...</span></div>
            <div>Chargement des données...</div>
          </div>
        </div>
      )}

      <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Commande</div>
        <div className="breadcrumb-subtitle">{isClientCommande ? 'Commande client' : 'Commande Fournisseur'}</div>
        <div className="ps-3">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 p-0">
              <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
              <li className="breadcrumb-item active" aria-current="page">{isClientCommande ? 'livraison' : 'réception'}</li>
            </ol>
          </nav>
        </div>
        <div className="ms-auto">
          <div className="btn-group">
            <button className="btn btn-primary mb-3 mb-lg-0" onClick={() => navigate(isClientCommande ? '/liste-commandes?mode=vente' : '/liste-commandes')}>Liste des commandes</button>
          </div>
        </div>
      </div>
      <hr />

      <div className="card">
        <div className="card-header bg-primary text-white">
          {isClientCommande ? 'Référence de la commande et de la livraison' : 'Référence de la commande et de la réception'}
        </div>
        <div className="card-body">
          <div className="row mb-4">
            <div className="col-md-2">
              <label htmlFor={isClientCommande ? 'date_livraison' : 'date_reception'} className="form-label">{isClientCommande ? 'Date de livraison' : 'Date de réception'} <span className="text-danger">*</span></label>
              <input type="text" name="date_livraison" className="form-control" id={isClientCommande ? 'date_livraison' : 'date_reception'} value={formatLocalDate(dateLivraisonIso)} readOnly />
            </div>
            <div className="col-md-2">
              <label htmlFor={isClientCommande ? 'ref_livraison' : 'ref_reception'} className="form-label">{isClientCommande ? 'Réf livraison' : 'Réf réception'} <span className="text-danger">*</span></label>
              <input type="text" name="ref_livraison" className="form-control" id={isClientCommande ? 'ref_livraison' : 'ref_reception'} value={refLivraison} readOnly />
            </div>
            <div className="col-md-2">
              <label htmlFor="ref_commande" className="form-label">Réf Commande <span className="text-danger">*</span></label>
              <input type="text" className="form-control" name="reference" id="ref_commande" value={vente?.reference || ''} readOnly />
            </div>
            <div className="col-md-3">
              <label htmlFor="date_commande" className="form-label">Date commande <span className="text-danger">*</span></label>
              <input type="text" className="form-control" name="date_commande" id="date_commande" value={formatServerDate(vente?.date_cmd_client || vente?.dateCommande || vente?.date || '')} readOnly />
            </div>
            <div className="col-md-3">
              <label htmlFor="id_client" className="form-label">{isClientCommande ? 'Client' : 'Fournisseur'} <span className="text-danger">*</span></label>
              <input type="text" name="client" className="form-control" id="id_client" value={vente?.nomClient || `${vente?.client?.prenom || ''} ${vente?.client?.nom || ''}`.trim() || ''} readOnly />
              {/* <small className="form-text text-muted">{isClientCommande ? 'Commande client' : 'Commande Fournisseur'}</small> */}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="row" noValidate>
        <div className="col-xl-12">
          <div className="card">
            <div className="card-header bg-primary text-white">Articles sélectionnés</div>
            <div className="card-body">
              <div className="form-group mb-4">
                <label htmlFor="commande_select">Sélectionnez une commande :</label>
                <div className="d-flex">
                  <select className="form-select me-2" value={selectedVenteId || ''} onChange={(e) => handleSelectVente(e.target.value || null)}>
                    <option value="">-- Sélectionner une commande --</option>
                    {(ventes || []).filter((v: any) => v.type === 'commande-client').map((v: any) => {
                      const totalReceived = (v.lignes || []).reduce((acc: number, ln: any) => acc + (ln.quantiteLivre || ln.qte_livre || 0), 0);
                      const totalOrdered = (v.lignes || []).reduce((acc: number, ln: any) => acc + (ln.quantite || ln.quantiteCommande || 0), 0) || 1;
                      const receivedPct = ((totalReceived / totalOrdered) * 100).toFixed(1);

                      // Pour les commandes clients, utiliser la référence de la commande
                      const refLabel = v.reference || `Commande ${v.id}`;

                      // debug si structure inattendue
                      if (!v.reference) console.debug('commande-client sans référence', { id: v.id, v });

                      return (
                        <option key={`commande-client-${v.id}`} value={v.id}>
                          {refLabel} - {v.client?.nom || v.nomClient || '-'} - Commande client - {receivedPct}% reçu
                        </option>
                      );
                    })}
                  </select>

                </div>
              </div>



              <table className="table table-bordered table-striped">
              <thead>
                <tr>
                  <th>DÉPÔT</th>
                  <th>DESIGNATION</th>
                  <th>STOCK</th>
                  <th>QTE COMMANDE</th>
                  <th>QTE LIVRÉE</th>
                  <th>QTE RESTANTE</th>
                  <th>LIVRAISON ACTUELLE</th>
                </tr>
              </thead>
              <tbody>
                {lignes.length === 0 && (
                  <tr><td colSpan={7} className="text-center">Aucune ligne à livrer pour cette vente</td></tr>
                )}
                {lignes.map((l, i) => {
                  const stockInfo = stocks.find(s => s.id === l.id_stock);
                  const remaining = (l.quantiteCommande || 0) - (l.quantiteLivre || 0);
                  return (
                    <tr key={l.id || i}>
                      <td><span className="badge bg-info text-white">{stockInfo?.magasin?.nom || (stockInfo?.produit?.nomProduit ? 'Dépôt inconnu' : '-')}</span></td>
                      <td>{l.designation}{stockInfo?.produit?.unite?.libelle ? ` (${stockInfo.produit.unite.libelle})` : ''}</td>
                      <td>{stockInfo?.quantiteDisponible ?? '-'}</td>
                      <td>
                        {(() => {
                          const unit = stockInfo?.produit?.unite?.libelle || 'u';
                          const nombreUnites = stockInfo?.produit?.nombreUnitesParConditionnement ?? null;
                          if (l.quantiteConditionnement && l.quantiteConditionnement > 0) {
                            return (<>
                              <div>{l.quantiteConditionnement} {unit}</div>
                              <div style={{fontSize: '0.8em'}}>(≈ {l.quantiteCommande || 0} u — 1 {unit} = {nombreUnites ?? 0} u)</div>
                            </>);
                          }
                          return (<span>{l.quantiteCommande || 0} {unit}</span>);
                        })()}
                      </td>
                      <td>
                        {(() => {
                          const unit = stockInfo?.produit?.unite?.libelle || 'u';
                          const nombreUnites = stockInfo?.produit?.nombreUnitesParConditionnement ?? null;
                          if (l.quantiteConditionnement && l.quantiteConditionnement > 0) {
                            // show delivered in conditionnement if possible
                            const deliveredUnits = l.quantiteLivre || 0;
                            const deliveredCond = nombreUnites ? Math.floor(deliveredUnits / nombreUnites) : 0;
                            return (<>
                              <div>{deliveredCond} {unit}</div>
                              <div style={{fontSize: '0.8em'}}>(≈ {deliveredUnits} u)</div>
                            </>);
                          }
                          return (<span>{l.quantiteLivre || 0} {unit}</span>);
                        })()}
                      </td>
                      <td>
                        {(() => {
                          const unit = stockInfo?.produit?.unite?.libelle || 'u';
                          const nombreUnites = stockInfo?.produit?.nombreUnitesParConditionnement ?? null;
                          if (l.quantiteConditionnement && l.quantiteConditionnement > 0) {
                            const deliveredUnits = l.quantiteLivre || 0;
                            const deliveredCond = nombreUnites ? Math.floor(deliveredUnits / nombreUnites) : 0;
                            return (<span>{Math.max((l.quantiteConditionnement || 0) - deliveredCond, 0)} {unit}</span>);
                          }
                          return (<span>{remaining} {unit}</span>);
                        })()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              type="number"
                              className="form-control"
                              value={l.quantiteLivreeNow || 0}
                              min={0}
                              max={remaining}
                              onChange={(e) => {
                                const newVal = Number(e.target.value) || 0;
                                if (newVal > remaining) {
                                  Swal.fire('Erreur', `La quantité ne peut pas dépasser ${remaining} (quantité restante)`, 'warning');
                                  return;
                                }
                                if (l.id_stock) {
                                  const stock = stocks.find(s => s.id === l.id_stock);
                                  if (stock && newVal > (stock.quantiteDisponible || 0)) {
                                    Swal.fire('Erreur', `Stock insuffisant (${stock.quantiteDisponible}) pour cette ligne`, 'warning');
                                    return;
                                  }
                                }
                                handleChangeLine(i, 'quantiteLivreeNow', newVal);
                              }}
                              style={{ width: 140 }}
                            />
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => {
                              // Livrer tout : remplir avec la quantité restante en unités
                              handleChangeLine(i, 'quantiteLivreeNow', remaining);
                            }}>Livrer tout</button>
                          </div>

                          <small className="text-muted">{`Réel: ${l.quantiteLivreeNow || 0}${stockInfo?.produit?.unite?.libelle ? ` ${stockInfo.produit.unite.libelle}` : ''}`}</small>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

                <div className="row mt-4">
                  <div className="col-12">
                    <button
                      id="valider-btn"
                      name="valider"
                      className="btn btn-primary float-end"
                      type="submit"
                      style={{ display: lignes.length > 0 ? 'block' : 'none' }}
                    >
                      Valider
                    </button>
                  </div>
                </div>

            {serverError && (
                <div className="alert alert-danger mt-3">
                  <strong>{serverError.message}</strong>
                  {serverError.details && <pre className="mt-2">{JSON.stringify(serverError.details, null, 2)}</pre>}
                </div>
              )}

            </div> {/* card-body */}
          </div> {/* card */}
        </div> {/* col-xl-12 */}
      </form>
    </div>
  );
};

export default VenteLivraison;