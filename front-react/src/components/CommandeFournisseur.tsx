import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import SearchableSelect from './SearchableSelect';
import { toDatetimeLocalInput } from '../utils/date';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';

interface Stock {
  id: number;
  quantiteDisponible: number;
  produit: {
    id: number;
    nomProduit: string;
    prixAchat: number;
    prixDetail?: number;
    prixEnGros?: number;
    // number of base units per conditionnement (e.g., carton = 12)
    nombreUnitesParConditionnement?: number;
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
  uid: string; // unique identifier for react keys and local updates
  id_stock?: number | null;
  produitId?: number;
  ligneId?: number | null;
  nom: string;
  quantite: number; // units when selling by unit
  venteParConditionnement?: boolean;
  quantiteConditionnement?: number; // number of conditionnements when selling by conditionnement
  multiplicateur?: number; // cached nombre d'unités par conditionnement
  prix: number;
  montant: number;
} 

interface CommandeFournisseurProps { isVente?: boolean }

const CommandeFournisseur: React.FC<CommandeFournisseurProps> = ({ isVente = false }) => {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedFournisseur, setSelectedFournisseur] = useState('');
  // Vente mode: client name instead of fournisseur

  // Vente: price mode toggle (DETAIL = prix_detail, GROS = prix_en_gros)
  const [priceModeDefault, setPriceModeDefault] = useState<'DETAIL' | 'GROS'>('DETAIL');
  // uid generator ref to avoid collisions when creating temporary UIDs
  const uidCounterRef = React.useRef(0);
  const nextUid = () => `tmp-${uidCounterRef.current++}`;
  const { id } = useParams();
  const [isEditMode, setIsEditMode] = useState(false);
  const [reference, setReference] = useState('');
  const [dateCommande, setDateCommande] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStockOption, setSelectedStockOption] = useState<string | number | null>(null);

  // Helper: return numeric multiplier (nombre d'unités par conditionnement) robustly
  const getProduitMultiplicateur = (s?: Stock): number => {
    if (!s || !s.produit) return 0;
    const anyProd: any = s.produit as any;
    // Try common known fields
    const candidates = [
      'nombreUnitesParConditionnement',
      'nombre_unites_par_conditionnement',
      'nombreUnitesParConditionnement',
      'quantiteParConditionnement',
      'quantite_par_conditionnement',
      'quantiteInitialeConditionnements',
      'quantite_initiale_conditionnements',
      'initialQuantityPerConditionnement'
    ];
    for (const key of candidates) {
      const raw = anyProd[key];
      if (raw !== undefined && raw !== null) {
        const n = parseInt(String(raw).replace(/[^0-9\-]/g, ''), 10);
        if (!isNaN(n) && n > 0) return n;
      }
    }
    // As a last resort, scan all properties for a numeric value that looks like a multiplier
    for (const k of Object.keys(anyProd)) {
      const v = anyProd[k];
      if (typeof v === 'string' || typeof v === 'number') {
        const n = parseInt(String(v).replace(/[^0-9\-]/g, ''), 10);
        if (!isNaN(n) && n > 0 && /conditionn|condit/i.test(k)) return n;
      }
    }
    return 0;
  };

  // Robust product display name resolver: handles different product field shapes
  const getProductDisplayName = (stockInfo?: Stock, ligne?: any) => {
    const prod = (stockInfo && (stockInfo as any).produit) || (ligne && ligne.produit) || (ligne && ligne.stock && ligne.stock.produit);
    if (prod) {
      return (prod.nomProduit || prod.nom || prod.designation || prod.libelle || prod.name || prod.label || '').toString().trim() || (ligne && ligne.designation) || 'Produit inconnu';
    }
    return (ligne && ligne.designation) || 'Produit inconnu';
  }; 

  // prettyJson helper removed (unused)

  // inspectStock helper removed (unused)

  // Fournisseur modal state
  const [showFournisseurModal, setShowFournisseurModal] = useState(false);
  const [newFournisseur, setNewFournisseur] = useState<{ prenom?: string; nom?: string; contact?: string; ville?: string }>({});
  const [fournisseurSearch, setFournisseurSearch] = useState('');

  // Client modal & list (used in Vente mode)
  const [clients, setClients] = useState<any[]>([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [newClient, setNewClient] = useState<{ prenom?: string; nom?: string; contact?: string; ville?: string }>({});
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const s = await fetchStocks();
      await fetchFournisseurs();
      await fetchClients();
      generateReference();
      // default local datetime for datetime-local input (avoid using toISOString which yields UTC)
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const localDt = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      setDateCommande(localDt);
      if (id) {
        setIsEditMode(true);
        await fetchCommandeForEdit(parseInt(id), s);
      }
    })();
  }, [id]);

  // Ensure body class and scrolling behavior while modal is open
  useEffect(() => {
    // If either modal is open, prevent body scrolling
    if (showFournisseurModal || showClientModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [showFournisseurModal, showClientModal]);

  const fetchCommandeForEdit = async (commandeId: number, loadedStocks?: Stock[]) => {
    try {
      const token = localStorage.getItem('smb_token');
      let res = null as any;
      if (isVente) {
        // Try vente endpoint first, then fallback to commandes-clients
        res = await fetch(`http://localhost:8085/api/ventes/${commandeId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          res = await fetch(`http://localhost:8085/api/commandes-clients/${commandeId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      } else {
        res = await fetch(`http://localhost:8085/api/commandes-fournisseurs/${commandeId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      if (!res.ok) throw new Error('Erreur lors du chargement de la commande');
      const data = await res.json();
      // populate form
      setReference(data.reference || '');
      // convert server date to yyyy-MM-ddTHH:mm (without timezone shift)
      if (data.dateCommande) {
        setDateCommande(toDatetimeLocalInput(data.dateCommande));
      }
      // For ventes (commande client), populate client info; otherwise populate fournisseur
      if (isVente) {
        // API may return direct nomClient or a client object
        // Use client id only for ventes; do not use free-text nomClient
        setSelectedClientId(data.client?.id || null);
        // If the saved lignes had a priceMode (e.g., GROS), initialize global mode so user can switch
        if (data.lignes && data.lignes.length > 0 && data.lignes[0].priceMode) {
          try {
            const pm = String(data.lignes[0].priceMode).toUpperCase();
            if (pm === 'DETAIL' || pm === 'GROS') setPriceModeDefault(pm as 'DETAIL' | 'GROS');
          } catch (e) { /* ignore */ }
        }
      } else {
        setSelectedFournisseur(data.fournisseur?.id ? String(data.fournisseur.id) : '');
      }
      // build cart from lignes
      if (data.lignes) {
        const stocksRef = loadedStocks && loadedStocks.length > 0 ? loadedStocks : stocks;
        const loadedCart = data.lignes.map((l: any) => {
          const stockId = l.stock?.id;
          const stockInfo = stocksRef ? stocksRef.find(s => s.id === stockId) : undefined;
          const nomProduit = getProductDisplayName(stockInfo, l);
          const basePrice = Number(stockInfo?.produit?.prixAchat ?? l.produit?.prixAchat ?? l.stock?.produit?.prixAchat ?? l.prix ?? 0);
          const prix = l.newPrice !== undefined && l.newPrice !== null ? Number(l.newPrice) : (l.prix !== undefined && l.prix !== null ? Number(l.prix) : basePrice);
          const quantite = l.quantite || 1;
          // ensure unique uid for each loaded ligne
          const uidVal = l.id ? `ligne-${l.id}` : nextUid();
          // compute multiplicateur from stockInfo or from the returned ligne product info
          let multiplicateur = 0;
          if (stockInfo) multiplicateur = getProduitMultiplicateur(stockInfo);
          else if (l.stock && l.stock.produit) {
            const miniStock: any = { produit: l.stock.produit };
            multiplicateur = getProduitMultiplicateur(miniStock as any);
          } else if (l.produit) {
            const miniProd: any = { produit: l.produit };
            multiplicateur = getProduitMultiplicateur(miniProd as any);
          }

          return { uid: uidVal, id_stock: stockId || null, ligneId: l.id || null, produitId: l.produit?.id || null, nom: nomProduit, quantite, prix, montant: prix * quantite, multiplicateur, ...(isVente ? { venteParConditionnement: false, quantiteConditionnement: 1 } : {}) };
        });
        setCart(loadedCart);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    }
  };

  const generateReference = () => {
    const now = new Date();
    const prefix = isVente ? 'CMC' : 'CMF';
    const ref = `${prefix}-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    setReference(ref);
  };

  // Ensure reference prefix updates if mode (vente/achat) changes
  useEffect(() => {
    generateReference();
  }, [isVente]);

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

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch('http://localhost:8085/api/clients-grossistes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors du chargement des clients');
      const data = await res.json();
      setClients(data);
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

      // For Vente: prefer the configured price mode (DÉTAIL / GROS) and ignore stored lastPrice when selecting a product
      let defaultPrice = Number(stock.produit?.prixAchat ?? 0);
      if (isVente && stock.produit) {
        const modePrice = priceModeDefault === 'DETAIL' ? stock.produit?.prixDetail : stock.produit?.prixEnGros;
        defaultPrice = Number(modePrice ?? stock.produit?.prixAchat ?? 0);
      } else if (stock.produit) {
        // Non-vente: try to use last used price if available, otherwise prixAchat
        const lastPriceKey = `lastPrice_${stock.produit.id}`;
        const lastPrice = localStorage.getItem(lastPriceKey);
        defaultPrice = lastPrice ? parseFloat(lastPrice) : Number(stock.produit?.prixAchat ?? 0);
      }

      if (defaultPrice <= 0) {
        Swal.fire('Attention', 'Le prix de ce produit n\'est pas défini. Veuillez le saisir manuellement.', 'warning');
      }

      const multiplicateur = getProduitMultiplicateur(stock);
      const newItem: CartItem = {
        uid: nextUid(),
        id_stock: stock.id,
        produitId: stock.produit?.id,
        nom: getProductDisplayName(stock),
        quantite: 1,
        prix: defaultPrice,
        montant: defaultPrice,
        multiplicateur: multiplicateur,
        // Add conditionnement fields only for sales so achat remains unchanged
        ...(isVente ? { venteParConditionnement: false, quantiteConditionnement: 1 } : {})
      };  

      setCart(prev => [...prev, newItem]);
    } catch (error) {
      console.error('Erreur lors de la sélection du produit:', error);
      Swal.fire('Erreur', 'Une erreur est survenue lors de la sélection du produit', 'error');
    }
  };

  const updateQuantity = (uid: string, quantite: number) => {
    setCart(prev => prev.map(item => {
      if (item.uid !== uid) return item;
      // only update unit quantity when selling by unit
      if (item.venteParConditionnement) return item;
      const newMontant = item.prix * quantite;
      const updated = { ...item, quantite, montant: newMontant };
      if (process.env.NODE_ENV !== 'production') console.debug('updateQuantity', { uid, quantite, updated });
      return updated;
    }));
  };

  const updateConditionnementQuantity = (uid: string, quantiteConditionnement: number) => {
    if (!isVente) return; // guard: only for ventes
    setCart(prev => prev.map(item => {
      if (item.uid !== uid) return item;
      if (!item.venteParConditionnement) return item;
      const stock = stocks.find(s => s.id === item.id_stock);
      const multiplier = getProduitMultiplicateur(stock);
      const realQ = quantiteConditionnement * multiplier;
      const newMontant = item.prix * realQ;
      const updated = { ...item, quantiteConditionnement, montant: newMontant };
      if (process.env.NODE_ENV !== 'production') console.debug('updateConditionnementQuantity', { uid, quantiteConditionnement, multiplier, updated });
      return updated;
    }));
  };

  const toggleVenteParConditionnement = (uid: string, venteParConditionnement: boolean) => {
    if (!isVente) return; // guard: only allow toggling in sale mode
    setCart(prev => prev.map(item => {
      if (item.uid !== uid) return item;
      const stock = stocks.find(s => s.id === item.id_stock);
      const multiplier = getProduitMultiplicateur(stock);
      console.debug('toggleVenteParConditionnement called', { uid, venteParConditionnement, multiplier });
      // initialize quantiteConditionnement to 1 when turning on
      const qCond = venteParConditionnement ? (item.quantiteConditionnement || 1) : item.quantite;
      const realQ = venteParConditionnement ? qCond * (multiplier || 1) : (item.quantite || 1);
      // If product has no multiplier, do not switch to conditionnement
      if (venteParConditionnement && (!multiplier || multiplier <= 1)) {
        console.debug('Cannot switch to conditionnement: multiplier missing or <=1', { uid, multiplier });
        return item;
      }
      return { ...item, venteParConditionnement, quantiteConditionnement: venteParConditionnement ? qCond : undefined, quantite: venteParConditionnement ? 1 : (item.quantite || 1), montant: item.prix * realQ };
    }));
  };

  const updatePrice = (uid: string, prix: number) => {
    if (isVente) {
      Swal.fire('Info', 'Le prix est calculé automatiquement pour les ventes (DÉTAIL/GROS) et ne peut pas être modifié manuellement.', 'info');
      return;
    }

    setCart(prev => prev.map(item =>
      item.uid === uid
        ? (item.venteParConditionnement ? (() => { const stock = stocks.find(s => s.id === item.id_stock); const multiplier = stock?.produit?.nombreUnitesParConditionnement || 0; const realQ = (item.quantiteConditionnement || 0) * multiplier; return { ...item, prix, montant: prix * realQ }; })() : { ...item, prix, montant: prix * item.quantite })
        : item
    ));

    // Save last used price for this product in localStorage (only for non-vente flows)
    const item = cart.find(i => i.uid === uid);
    const stock = item ? stocks.find(s => s.id === item.id_stock) : undefined;
    if (stock && stock.produit) {
      const lastPriceKey = `lastPrice_${stock.produit.id}`;
      localStorage.setItem(lastPriceKey, prix.toString());
    }
  }; 

  // When price mode toggles in Vente mode, update cart item prices to reflect selected mode
  // When price mode, stocks or isVente change, normalize cart entries and recompute montants
  useEffect(() => {
    setCart(prev => prev.map(item => {
      const stock = stocks.find(s => s.id === item.id_stock);
      // ensure vente-only fields are present only when in vente mode
      let venteParConditionnement = item.venteParConditionnement;
      let quantiteConditionnement = item.quantiteConditionnement;
      let multiplicateur = item.multiplicateur;
      if (isVente) {
        if (venteParConditionnement === undefined) venteParConditionnement = false;
        if (quantiteConditionnement === undefined) quantiteConditionnement = 1;
        // Recompute multiplicateur if missing or previously zero (handles add-before-stocks-loaded case)
        if (multiplicateur === undefined || multiplicateur <= 1) multiplicateur = getProduitMultiplicateur(stock);
      } else {
        venteParConditionnement = undefined;
        quantiteConditionnement = undefined;
        multiplicateur = undefined;
      }

      // determine price (use global priceModeDefault)
      let newPrix = item.prix;
      if (isVente) {
        // prefer the stock's product if available, otherwise try to find a product by produitId across stocks
        const productSource = (stock && stock.produit) ? stock.produit : (item.produitId ? (stocks.find(s => s.produit?.id === item.produitId)?.produit) : undefined);
        if (productSource) {
          const modePrice = priceModeDefault === 'DETAIL' ? productSource.prixDetail : productSource.prixEnGros;
          if (modePrice !== undefined && modePrice !== null) newPrix = Number(modePrice);
        }
      }

      const multiplier = (venteParConditionnement && multiplicateur) ? multiplicateur : 1;
      const realQ = venteParConditionnement ? ((quantiteConditionnement || 0) * multiplier) : item.quantite;
      const newMontant = (newPrix || 0) * (realQ || 0);

      return { ...item, prix: newPrix, montant: newMontant, venteParConditionnement, quantiteConditionnement, multiplicateur };
    }));
  }, [priceModeDefault, stocks, isVente]);



  const removeFromCart = (uid: string) => {
    setCart(cart.filter(item => item.uid !== uid));
  };

  // Dev-only: log cart snapshot on changes to trace unexpected cross-updates
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('Cart snapshot:', cart.map(i => ({ uid: i.uid, id_stock: i.id_stock, produitId: i.produitId, quantite: i.quantite, qCond: i.quantiteConditionnement })));
    }
  }, [cart]);

  // recompute total based on effective quantities
  const total = cart.reduce((sum, item) => {
    const stock = stocks.find(s => s.id === item.id_stock);
    const multiplier = stock?.produit?.nombreUnitesParConditionnement || 0;
    const realQ = item.venteParConditionnement ? ((item.quantiteConditionnement || 0) * multiplier) : item.quantite;
    const montant = (item.prix || 0) * (realQ || 0);
    return sum + montant;
  }, 0);
  const zeroStockDetails = stocks.filter(stock => (stock.quantiteDisponible ?? 0) === 0);

  const handleSubmit = async () => {
    if (!isVente && !selectedFournisseur) {
      Swal.fire('Erreur', 'Veuillez sélectionner un fournisseur', 'error');
      return;
    }

    if (isVente && !selectedClientId) {
      Swal.fire('Erreur', 'Veuillez sélectionner un client', 'error');
      return;
    }

    if (cart.length === 0) {
      Swal.fire('Erreur', 'Le panier est vide', 'error');
      return;
    }

    // client-side payload building
    const produitsSelectionnes: any[] = [];
    const blockedForStock: number[] = [];
    cart.forEach(item => {
      const stock = stocks.find(s => s.id === item.id_stock);
      const multiplier = getProduitMultiplicateur(stock);
      // For sales, realQ is computed using conditionnement when applicable.
      // For purchases, we always treat quantite as units ordered and do NOT validate stock availability here.
      const realQ = (isVente && item.venteParConditionnement) ? ((item.quantiteConditionnement || 0) * multiplier) : item.quantite;

      // Only enforce stock availability for sales
      if (isVente) {
        // Check conditionnement activation rules: multiplicateur must be >1
        const effMultiplier = (item.multiplicateur || getProduitMultiplicateur(stock));
        if (item.venteParConditionnement && (!effMultiplier || effMultiplier <= 1)) {
          Swal.fire('Erreur', `Conditionnement non autorisé pour ${item.nom} : nombre_unites_par_conditionnement doit être > 1.`, 'error');
          return;
        }

        if (stock && (stock.quantiteDisponible ?? 0) < (realQ || 0)) {
          if (item.id_stock != null) blockedForStock.push(item.id_stock);
        }
      }

      // Build selection object and include ligneId / produitId to help backend map existing lignes when editing
      const baseObj: any = {
        id_stock: item.id_stock,
        produitId: item.produitId || undefined,
        ligneId: item.ligneId || undefined,
        prix: item.prix,
        priceMode: isVente ? priceModeDefault : undefined
      };

      if (isVente && item.venteParConditionnement) {
        produitsSelectionnes.push({ ...baseObj, venteParConditionnement: true, quantiteConditionnement: item.quantiteConditionnement });
      } else {
        produitsSelectionnes.push({ ...baseObj, quantite: item.quantite });
      }
    });

    if (blockedForStock.length > 0) {
      const labels = blockedForStock.map(id => {
        const it = cart.find(c => c.id_stock === id);
        return it ? `${it.nom} (stockId: ${id})` : `stockId: ${id}`;
      });
      Swal.fire('Erreur', `Stock insuffisant pour : ${labels.join(', ')}`, 'error');
      return;
    }

    let payload: any;
    if (isVente) {
      if (isEditMode && id) {
        // For editing an existing vente (stored as CommandeClient), include lignes modifications
        payload = {
          reference,
          dateCommande: dateCommande,
          total,
          paie: 0,
          client: { id: selectedClientId },
          produitsSelectionnes
        };
      } else {
        // Creation: use the VenteFullRequest shape
        payload = {
          reference,
          dateVente: dateCommande,
          client: selectedClientId ? { id: selectedClientId } : undefined,
          produitsSelectionnes,
          total
        };
      }
    } else {
      payload = {
        reference,
        dateCommande,
        fournisseur: { id: parseInt(selectedFournisseur) },
        produitsSelectionnes,
        total
      };
    }

    try {
      const token = localStorage.getItem('smb_token');
      let url = isEditMode && id ? `http://localhost:8085/api/commandes-fournisseurs/${id}` : 'http://localhost:8085/api/commandes-fournisseurs';
      let method = isEditMode && id ? 'PUT' : 'POST';
      if (isVente) {
        if (isEditMode && id) {
          // Edit existing vente stored as CommandeClient
          url = `http://localhost:8085/api/commandes-clients/${id}`;
          method = 'PUT';
        } else {
          // Create new vente (full)
          url = 'http://localhost:8085/api/ventes/full';
          method = 'POST';
        }
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let errData: any = null;
        try { errData = await res.json(); } catch (_) { errData = null; }
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
                  if (st) blockedLabels.push(`${getProductDisplayName(st)} (stockId: ${id})`);
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

        // Fallback to plain text message if JSON wasn't returned
        const txt = await res.text().catch(() => null);
        if (txt) {
          await Swal.fire('Erreur', txt, 'error');
          return;
        }

        throw new Error(`Erreur lors de la ${isEditMode ? 'modification' : 'création'}`);
      }

      const saved = await res.json().catch(() => ({}));
      Swal.fire('Succès', `Commande ${isEditMode ? 'modifiée' : 'créée'} avec succès`, 'success');
      // In edit mode, validate the response contains saved lignes matching our cart
      if (isEditMode && saved && saved.lignes) {
        // Build sets for fast lookup: by ligneId, stockId, produitId
        const savedByLigneId = new Set(saved.lignes.map((l: any) => l.id).filter(Boolean));
        const savedStockIds = new Set(saved.lignes.map((l: any) => l.stock?.id).filter(Boolean));
        const savedProduitIds = new Set(saved.lignes.map((l: any) => l.produit?.id).filter(Boolean));

        const missing = produitsSelectionnes.filter((ps: any) => {
          if (ps.ligneId && savedByLigneId.has(ps.ligneId)) return false;
          if (ps.id_stock && savedStockIds.has(ps.id_stock)) return false;
          if (ps.produitId && savedProduitIds.has(ps.produitId)) return false;
          return true;
        });

        if (missing.length > 0) {
          const missingLabels = missing.map((m: any) => {
            const c = cart.find(c => (c.ligneId && c.ligneId === m.ligneId) || (c.id_stock === m.id_stock) || (c.produitId && c.produitId === m.produitId));
            if (c) return c.nom + (c.id_stock ? ` (stockId:${c.id_stock})` : (c.produitId ? ` (produitId:${c.produitId})` : ''));
            return m.id_stock ? `stockId:${m.id_stock}` : (m.produitId ? `produitId:${m.produitId}` : 'Ligne inconnue');
          });
          Swal.fire('Attention', `Les produits suivants n'ont pas été enregistrés: ${missingLabels.join(', ')}`, 'warning');
        }
      }
      // Reset form
      setCart([]);
      setSelectedFournisseur('');
      generateReference();
      if (isEditMode) {
        // navigate back to listes after edit, preserving vente mode if applicable
        navigate('/liste-commandes' + (isVente ? '?mode=vente' : ''));
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
      if (!token) {
        Swal.fire('Erreur', 'Authentification nécessaire. Connectez-vous.', 'error');
        return;
      }

      // If it's a vente (commande client), try vente PDF endpoint first, then commandes-clients as fallback
      if (isVente) {
        const tryEndpoints = [
          { path: `http://localhost:8085/api/ventes/${idToOpen}/pdf`, label: 'ventes' },
          { path: `http://localhost:8085/api/commandes-clients/${idToOpen}/pdf`, label: 'commandes-clients' }
        ];
        let lastError: any = null;
        for (const ep of tryEndpoints) {
          try {
            const res = await fetch(ep.path, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank');
              return;
            }
            const text = await res.text().catch(() => '');
            lastError = `Endpoint ${ep.label} returned ${res.status} ${res.statusText}: ${text}`;
            console.debug('openPdfPrint:', lastError);
          } catch (e: any) {
            lastError = `Fetch to ${ep.label} failed: ${e.message}`;
            console.debug('openPdfPrint:', lastError);
          }
        }
        Swal.fire('Erreur', `Impossible de charger le PDF (vente). Détails: ${lastError}`, 'error');
        return;
      }

      // Default: commande fournisseur
      try {
        const res = await fetch(`http://localhost:8085/api/commandes-fournisseurs/${idToOpen}/pdf`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`${res.status} ${res.statusText}: ${text}`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } catch (e: any) {
        Swal.fire('Erreur', `Impossible de charger le PDF: ${e.message || e}`, 'error');
      }
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
              <h5>{isVente ? 'Commande Client' : 'Exécution de la commande fournisseur'}</h5>
            </div>
            <div className="card-body">
              {/* Breadcrumb */}
              <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
                <div className="breadcrumb-title pe-3">Commande</div>
                <div className="ps-3">
                  <nav aria-label="breadcrumb">
                    <ol className="breadcrumb mb-0 p-0">
                      <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
                      <li className="breadcrumb-item active" aria-current="page">{isVente ? 'Commande Client' : 'Commande Fournisseur '}</li>
                    </ol>
                  </nav>
                </div> 
                <div className="ms-auto">
                  <div className="btn-group">
                    <button className="btn btn-outline-primary mb-3 mb-lg-0 me-2" onClick={() => navigate('/liste-commandes' + (isVente ? '?mode=vente' : ''))}>
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
                <div className="col-md-3">
                  <label>Date et Heure</label>
                  <input type="datetime-local" className="form-control" value={dateCommande} readOnly />
                </div>
                {isVente && (
                  <div className="col-md-2">
                    <label>Mode de prix</label>
                    <div className="form-check form-switch">
                      <input className="form-check-input" id="priceModeToggle" type="checkbox" checked={priceModeDefault === 'DETAIL'} onChange={(e) => setPriceModeDefault(e.target.checked ? 'DETAIL' : 'GROS')} />
                      <label className="form-check-label" htmlFor="priceModeToggle">{priceModeDefault === 'DETAIL' ? 'DÉTAIL' : 'GROS'}</label>
                    </div>
                  </div>
                )}
                <div className="col-md-3">
                {isVente ? (
                  <>
                    <label>Client
                      <button type="button" className="btn btn-sm btn-outline-success ms-2" onClick={() => { setNewClient({}); setClientSearch(''); setShowClientModal(true); }}>
                        <i className='bx bx-plus'></i> Ajouter
                      </button>
                    </label>
                    <select className="form-control" value={selectedClientId ?? ''} onChange={(e) => { const v = e.target.value; setSelectedClientId(v ? parseInt(v) : null); }}>
                      <option value="">Sélectionner un client</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.prenom} {c.nom} - {c.contact}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
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
                  </>
                )}
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
                            options={stocks.map((stock) => {
                              const mult = getProduitMultiplicateur(stock);
                              const multLabel = mult > 1 ? ` - ${mult}u/cond` : '';
                              const price = isVente && stock.produit ? (priceModeDefault === 'DETAIL' ? (stock.produit?.prixDetail ?? stock.produit?.prixAchat) : (stock.produit?.prixEnGros ?? stock.produit?.prixAchat)) : (stock.produit?.prixAchat ?? 0);
                              return {
                                value: stock.id,
                                label: `${getProductDisplayName(stock)}${multLabel} - ${price} FCFA - ${stock.magasin?.nom || 'Dépôt inconnu'} (Stock: ${stock.quantiteDisponible || 0})`
                              }; 
                            })}
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
                                    <strong>{getProductDisplayName(stock)}</strong>
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
                      {isVente && <small className="text-light">Prix unitaire = unité de base. Si vous vendez par conditionnement, 1 conditionnement = X unités (utilisé comme multiplicateur).</small>}
                    </div>
                    <div className="card-body">
                      <div className="table-responsive">
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
                          {cart.map(item => {
                            const stock = stocks.find(s => s.id === item.id_stock);
                            const multiplier = (item.multiplicateur || getProduitMultiplicateur(stock));
                            const realQ = (item.venteParConditionnement && isVente) ? ((item.quantiteConditionnement || 0) * multiplier) : item.quantite;
                            const montant = (item.prix || 0) * (realQ || 0);
                            return (
                              <tr key={item.uid}>
                                <td>{item.nom}</td>
                                <td>
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    {isVente ? (
                                      <>
                                        <div className="form-check form-check-inline">
                                          <input className="form-check-input" type="radio" name={`mode_${item.uid}`} id={`mode_unite_${item.uid}`} checked={!item.venteParConditionnement} onChange={() => toggleVenteParConditionnement(item.uid, false)} onClick={() => toggleVenteParConditionnement(item.uid, false)} title="Vendre en unités" />
                                          <label className="form-check-label" htmlFor={`mode_unite_${item.uid}`}>Unité</label>
                                        </div>
                                        <div className="form-check form-check-inline">
                                          <input className="form-check-input" type="radio" name={`mode_${item.uid}`} id={`mode_cond_${item.uid}`} checked={!!item.venteParConditionnement} onChange={() => toggleVenteParConditionnement(item.uid, true)} onClick={() => toggleVenteParConditionnement(item.uid, true)} disabled={multiplier <= 1} title={multiplier <= 1 ? 'Conditionnement non disponible (nombre_unites_par_conditionnement doit être > 1)' : 'Vendre par conditionnement'} />
                                          <label className="form-check-label" htmlFor={`mode_cond_${item.uid}`}>Conditionnement {multiplier > 1 ? `(${multiplier} unités)` : ''}</label>
                                        </div>

                                        {item.venteParConditionnement ? (
                                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <label className="small">Qté (cond.)</label>
                                            <input type="number" className="form-control" value={item.quantiteConditionnement ?? 1} min={1} onChange={(e) => updateConditionnementQuantity(item.uid, parseInt(e.target.value) || 1)} style={{ width: 120 }} disabled={multiplier <= 1} />
                                            <div className="text-muted small">1 cond = {multiplier}u</div>
                                          </div>
                                        ) : (
                                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <label className="small">Qté</label>
                                            <input
                                              type="number"
                                              className="form-control"
                                              value={item.quantite}
                                              min="1"
                                              onChange={(e) => updateQuantity(item.uid, parseInt(e.target.value) || 1)}
                                              style={{ width: 120 }}
                                            />
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      // Achat mode: keep the original simple quantity input (no radios)
                                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <label className="small">Qté</label>
                                        <input
                                          type="number"
                                          className="form-control"
                                          value={item.quantite}
                                          min="1"
                                          onChange={(e) => updateQuantity(item.uid, parseInt(e.target.value) || 1)}
                                          style={{ width: 120 }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div className="input-group input-group-sm">

                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      value={item.prix}
                                      min="0"
                                      step="0.01"
                                      onChange={(e) => updatePrice(item.uid, parseFloat(e.target.value) || 0)}
                                      disabled={isVente}
                                      title={isVente ? 'Prix calculé automatiquement pour les ventes (DÉTAIL / GROS)' : ''}
                                    />
                                    {isVente ? (
                                      <span className="input-group-text" title="Prix automatique"><i className="bx bx-lock"></i></span>
                                    ) : (() => {
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
                                <td>{montant.toFixed(2)} FCFA</td>
                                <td>
                                  <div className="d-flex">
                                    <button className="btn btn-danger btn-sm" onClick={() => removeFromCart(item.uid)} title="Supprimer">
                                      <i className="bx bx-trash"></i>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
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

      {/* Client modal (Vente mode) */}
      {showClientModal && createPortal(
        <div className="modal show d-block" tabIndex={-1} role="dialog" style={{ zIndex: 2000 }}>
          <div className="modal-backdrop fade show" style={{ zIndex: 1999 }}></div>
          <div className="modal-dialog modal-lg modal-dialog-centered" role="document" style={{ zIndex: 2001 }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Ajouter / Sélectionner un client</h5>
                <button type="button" className="btn-close" onClick={() => setShowClientModal(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Rechercher un client existant</label>
                    <input className="form-control" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Tapez un nom ou contact" />
                    <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8 }}>
                      {clients.filter(c => {
                        if (!clientSearch) return true;
                        const s = clientSearch.toLowerCase();
                        return (c.prenom || '').toLowerCase().includes(s) || (c.nom || '').toLowerCase().includes(s) || (c.contact || '').toLowerCase().includes(s);
                      }).map(c => (
                        <div key={c.id} className="d-flex justify-content-between align-items-center p-2 border-bottom">
                          <div>
                            <strong>{c.prenom} {c.nom}</strong><br />
                            <small className="text-muted">{c.contact}</small>
                          </div>
                          <div>
                            <button className="btn btn-sm btn-outline-primary" onClick={() => { setSelectedClientId(c.id); setShowClientModal(false); }}>
                              Sélectionner
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Créer un nouveau client</label>
                    <div className="mb-2">
                      <input className="form-control" placeholder="Prénom" value={newClient.prenom || ''} onChange={(e) => setNewClient({ ...newClient, prenom: e.target.value })} />
                    </div>
                    <div className="mb-2">
                      <input className="form-control" placeholder="Nom" value={newClient.nom || ''} onChange={(e) => setNewClient({ ...newClient, nom: e.target.value })} />
                    </div>
                    <div className="mb-2">
                      <input className="form-control" placeholder="Contact" value={newClient.contact || ''} onChange={(e) => setNewClient({ ...newClient, contact: e.target.value })} />
                    </div>
                    <div className="mb-2">
                      <input className="form-control" placeholder="Ville" value={newClient.ville || ''} onChange={(e) => setNewClient({ ...newClient, ville: e.target.value })} />
                    </div>

                    <div className="d-flex justify-content-end mt-3">
                      <button className="btn btn-secondary me-2" onClick={() => { setNewClient({}); setClientSearch(''); setShowClientModal(false); }}>Annuler</button>
                      <button className="btn btn-success" onClick={async () => {
                        // Create new client via API
                        try {
                          const token = localStorage.getItem('smb_token');
                          const payload: any = { prenom: newClient.prenom, nom: newClient.nom, contact: newClient.contact, ville: newClient.ville };
                          const res = await fetch('http://localhost:8085/api/clients-grossistes', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify(payload)
                          });
                          if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            throw new Error(err && err.message ? err.message : `Erreur création client (${res.status})`);
                          }
                          const created = await res.json();
                          // Add to list and select
                          setClients(prev => [created, ...(prev || [])]);
                          setSelectedClientId(created.id);
                          setShowClientModal(false);
                        } catch (err: any) {
                          Swal.fire('Erreur', err.message || 'Erreur lors de la création du client', 'error');
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
    </div>
  );
};

export default CommandeFournisseur;