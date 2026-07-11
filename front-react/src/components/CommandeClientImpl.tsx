import React, { useEffect, useState } from 'react';
import { useFormatMoney } from '../utils/currency';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import SearchableSelect from './SearchableSelect';
import { toDatetimeLocalInput } from '../utils/date';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import useHasPermission from '../contexts/useHasPermission';
import RequirePermission from './RequirePermission';
import { useUser } from '../contexts/UserContext';
import PhoneWithDial from './PhoneWithDial';
import { API, withApi } from '../config/api';

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
  magasin?: {
    id?: number;
    nom?: string;
    // compatibility fields from older API shapes
    nomMagasin?: string;
    magasinId?: number;
    adresse?: string;
  };
  boutique?: {
    id?: number;
    nom?: string;
    adresse?: string;
  };
}


interface CartItem {
  uid: string; // unique identifier for react keys and local updates
  id_stock?: number | null;
  produitId?: number;
  ligneId?: number | null;
  nom: string;
  quantite: number | string; // units when selling by unit (allow empty string during edit)
  venteParConditionnement?: boolean;
  quantiteConditionnement?: number | string; // number of conditionnements when selling by conditionnement (allow empty during edit)
  multiplicateur?: number; // cached nombre d'unités par conditionnement
  prix: number;
  montant: number;
} 

const CommandeClient: React.FC = () => {
  const isVente = true;
  const navigate = useNavigate();
  const { currentBoutique } = useUser();
  const fmt = useFormatMoney();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Vente: price mode toggle (DETAIL = prix_detail, GROS = prix_en_gros)
  const [priceModeDefault, setPriceModeDefault] = useState<'DETAIL' | 'GROS'>('DETAIL');

  // Client modal & list (used in Vente mode)
  const [clients, setClients] = useState<any[]>([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [newClient, setNewClient] = useState<{ prenom?: string; nom?: string; contact?: string; ville?: string }>({});
  const [newClientCodePays, setNewClientCodePays] = useState<string | null>(null);
  const [newClientTelephoneValid, setNewClientTelephoneValid] = useState<boolean | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

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
    // Prefer explicit name returned by the stock API
    if (stockInfo && (stockInfo as any).nomProduit) return (stockInfo as any).nomProduit;

    const prod = (stockInfo && (stockInfo as any).produit) || (ligne && ligne.produit) || (ligne && ligne.stock && ligne.stock.produit);
    if (prod) {
      return (prod.nomProduit || prod.nom || prod.designation || prod.libelle || prod.name || prod.label || '').toString().trim() || (ligne && ligne.designation) || 'Produit inconnu';
    }

    // If stock contains only a produitId, show a helpful fallback
    const pid = stockInfo && ((stockInfo as any).produitId || (stockInfo as any).idProduit || (stockInfo as any).id_produit);
    if (pid) return `Produit #${pid}`;

    return (ligne && ligne.designation) || 'Produit inconnu';
  };

  // Packaging helpers -----------------------------------------------------
  // Format stock with cartons + open carton info per business rules
  const formatPackaging = (stockUnits: number, unitsPerCarton?: number) => {
    const u = Number(stockUnits || 0);
    const m = Number(unitsPerCarton || 0);
    if (!m || m <= 1) return `${u} unité${u > 1 ? 's' : ''}`;
    const full = Math.floor(u / m);
    const rem = u % m;
    if (rem === 0) return `${u} unités (${full} carton${full > 1 ? 's' : ''})`;
    const openPart = rem > 1 ? `${rem} unités ouvertes` : `${rem} unité ouverte`;
    const fullPart = full > 0 ? `${full} carton${full > 1 ? 's' : ''} + ` : '';
    return `${u} unités (${fullPart}${openPart})`;
  };

  // Helper to compute total units in cart for a given product id
  const getCartUnitsForProduct = (productId?: number) => {
    if (!productId) return 0;
    return cart.reduce((sum, it) => {
      if (it.produitId !== productId) return sum;
      if (it.venteParConditionnement) return sum + ((Number(it.quantiteConditionnement) || 0) * (it.multiplicateur || 1));
      return sum + (Number(it.quantite) || 0);
    }, 0);
  }; 

  // Helper to resolve price for a given product and mode (accounts for various field names)
  const getModePriceFromProduct = (product: any, mode: 'DETAIL'|'GROS') => {
    if (!product) return undefined;
    if (mode === 'DETAIL') {
      return product.prixDetail ?? product.prix_detail ?? product.prix_detaille ?? product.prixDetaille ?? product.prix ?? undefined;
    }
    return product.prixEnGros ?? product.prix_en_gros ?? product.prixGros ?? product.prix_gros ?? product.prix ?? undefined;
  };

  // End helpers ------------------------------------------------------------



  // Permissions
  const canCreateCommande = useHasPermission('COMMANDE_CREER');
  const canModifyCommande = useHasPermission('COMMANDE_MODIFIER');
  const canCreateClient = useHasPermission('CLIENT_CREER');
  const { logout } = useUser();

  // Helper: check if stored JWT token is expired (simple client-side check)
  const isTokenExpired = (token?: string | null) => {
    if (!token) return true;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false; // not a JWT, assume fine
      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return false;
      const now = Math.floor(Date.now() / 1000);
      return payload.exp < now;
    } catch (e) { return false; }
  };

  // Location (boutique / magasin) state and helpers
  const [magasins, setMagasins] = useState<any[]>([]);
  const [locationType, setLocationType] = useState<'BOUTIQUE'|'MAGASIN'>('BOUTIQUE');
  const [selectedMagasinId, setSelectedMagasinId] = useState<number | null>(null);
  // By default sales occur in the boutique and the emplacement is locked; certain users can unlock
  const [locationLocked, setLocationLocked] = useState<boolean>(true);

  // Products cache to enrich stocks (ensure prices are available when stock.produit is absent)
  const [produits, setProduits] = useState<any[]>([]);
  const fetchProduits = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`${API}/produits`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) throw new Error('Erreur lors du chargement des produits');
      const data = await res.json();
      setProduits(data || []);
      return data || [];
    } catch (e: any) {
      console.error('fetchProduits error', e);
      return [];
    }
  };

  const fetchMagasins = async () => {
    try {
      const token = localStorage.getItem('smb_token');
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
      const token = localStorage.getItem('smb_token');
      const lt = locType || locationType;
      if (lt === 'MAGASIN') {
        const idToUse = magId || selectedMagasinId;
        if (!idToUse) return [];
        const res = await fetch(withApi(`magasins/${idToUse}/stocks`), { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (!res.ok) throw new Error('Impossible de charger les produits du magasin');
        const data = await res.json();
        // Normalize stocks so that product name and prices are available even when API returns produitId / nomProduit only
        const productMap: Record<string, any> = {};
        (produits || []).forEach((p: any) => { if (p && p.id) productMap[String(p.id)] = p; });

        const normalized = (data || []).map((s: any) => {
          const prodId = s.produitId || s.idProduit || s.id_produit || (s.produit && s.produit.id);
          // prefer s.produit if available, else use catalog product if present
          let produit = s.produit;
          if (!produit && prodId && productMap[String(prodId)]) {
            produit = productMap[String(prodId)];
          }
          // fallback minimal produit with id and placeholder name
          if (!produit && prodId) produit = { id: prodId, nomProduit: s.nomProduit || `Produit ${prodId}` };

          // Ensure price fields are present when possible (prixAchat/prixDetail/prixEnGros)
          const prixAchat = produit ? (produit.prixAchat ?? produit.prix_a_achat ?? produit.prix) : undefined;
          const prixDetail = produit ? (produit.prixDetail ?? produit.prix_detail ?? produit.prix_detaille ?? produit.prixDetaille) : undefined;
          const prixEnGros = produit ? (produit.prixEnGros ?? produit.prix_en_gros ?? produit.prixGros) : undefined;

          const finalProduit = { ...produit, prixAchat, prixDetail, prixEnGros };

          return { ...s, produit: finalProduit, nomProduit: s.nomProduit || (finalProduit ? (finalProduit.nomProduit || finalProduit.nom) : undefined) };
        });
        setStocks(normalized);
        return normalized;
      } else {
        const res = await fetch(`${API}/stocks`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (!res.ok) throw new Error('Impossible de charger les stocks');
        const data = await res.json();
        const boutiqueOnly = (data || []).filter((s: any) => !s.magasin).map((s: any) => {
          const prodId = s.produitId || s.idProduit || s.id_produit || (s.produit && s.produit.id);
          const prodName = s.nomProduit || s.produit?.nomProduit || s.produit?.nom || s.produit?.name;
          const produit = s.produit || (prodId ? { id: prodId, nomProduit: prodName || `Produit ${prodId}` } : undefined);
          return { ...s, produit, nomProduit: s.nomProduit || (produit ? (produit.nomProduit || produit.nom) : undefined) };
        });
        setStocks(boutiqueOnly);
        return boutiqueOnly;
      }
    } catch (e: any) {
      Swal.fire('Erreur', e.message || 'Erreur lors du chargement des stocks', 'error');
      return [];
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // load products first so we can enrich stocks with price info
        await fetchProduits();

        const mags = await fetchMagasins();
        // For ventes (commande client) default to BOUTIQUE and lock the emplacement
        setLocationType('BOUTIQUE');
        setLocationLocked(true);
        await fetchStocksByLocation('BOUTIQUE');

        // Keep magasin list handy so permitted users can unlock and choose one
        if (mags && mags.length > 0) setMagasins(mags);

        await fetchClients();
        generateReference();
        // default local datetime for datetime-local input (avoid using toISOString which yields UTC)
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const localDt = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
        setDateCommande(localDt);
        if (id) {
          setIsEditMode(true);
          await fetchCommandeForEdit(parseInt(id), stocks);
        }
      } catch (err: any) {
        setError(err.message || 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Whenever the location or selected magasin changes and emplacement is unlocked, refresh stocks
  useEffect(() => {
    (async () => {
      if (!locationLocked) {
        if (locationType === 'MAGASIN' && selectedMagasinId) {
          await fetchStocksByLocation('MAGASIN', selectedMagasinId);
        } else {
          await fetchStocksByLocation('BOUTIQUE');
        }
      }
    })();
  }, [locationLocked, locationType, selectedMagasinId]);

  // Ensure body class and scrolling behavior while modal is open
  useEffect(() => {
    // Prevent body scrolling when client modal is open
    if (showClientModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [showClientModal]);

  const fetchCommandeForEdit = async (commandeId: number, loadedStocks?: Stock[]) => {
    try {
      const token = localStorage.getItem('smb_token');
      let res = null as any;
      if (isVente) {
        // Try vente endpoint first, then fallback to commandes-clients
        res = await fetch(`${API}/ventes/${commandeId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          res = await fetch(`${API}/commandes-clients/${commandeId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      } else {
        res = await fetch(`${API}/commandes-fournisseurs/${commandeId}`, {
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

          // Determine if the saved ligne was entered by conditionnement and restore it for editing
          let savedQuantiteConditionnement = undefined as number | undefined;
          if (l.quantiteConditionnement !== undefined && l.quantiteConditionnement !== null) savedQuantiteConditionnement = l.quantiteConditionnement;
          else if (multiplicateur > 1 && l.quantite && l.quantite % multiplicateur === 0) savedQuantiteConditionnement = l.quantite / multiplicateur;

          const venteParConditionnement = savedQuantiteConditionnement !== undefined && savedQuantiteConditionnement > 0;
          const qCond = savedQuantiteConditionnement || 1;

          return { uid: uidVal, id_stock: stockId || null, ligneId: l.id || null, produitId: l.produit?.id || null, nom: nomProduit, quantite: quantite, prix, montant: prix * quantite, multiplicateur, venteParConditionnement, quantiteConditionnement: venteParConditionnement ? qCond : undefined };
        });
        setCart(loadedCart);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    }
  };

  const generateReference = () => {
    const now = new Date();
    const prefix = 'CMC';
    const ref = `${prefix}-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    setReference(ref);
  };

  // Generate reference on mount
  useEffect(() => {
    generateReference();
  }, []);





  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`${API}/clients-grossistes`, {
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
      if (stock.produit) {
        const modePrice = getModePriceFromProduct(stock.produit, priceModeDefault);
        defaultPrice = Number(modePrice ?? stock.produit?.prixAchat ?? 0);
      }

      if (defaultPrice <= 0) {
        Swal.fire('Attention', 'Le prix de ce produit n\'est pas défini. Veuillez le saisir manuellement.', 'warning');
      }

      const multiplicateur = getProduitMultiplicateur(stock);
      // If there is an open carton in stock, warn the user so successive sales prioritize it
      if (multiplicateur > 1) {
        const remainderBefore = ((stock.quantiteDisponible || 0) % multiplicateur + multiplicateur) % multiplicateur;
        if (remainderBefore > 0) {
          Swal.fire('Attention', `Attention : ${remainderBefore} unité${remainderBefore > 1 ? 's' : ''} restantes dans le carton déjà ouvert`, 'warning');
        }
      }
      // Default: checkbox unchecked for ventes
      const defaultVenteParConditionnement = false;
      const initialQuantiteUnits = 1;
      const newItem: CartItem = {
        uid: nextUid(),
        id_stock: stock.id,
        produitId: stock.produit?.id,
        nom: getProductDisplayName(stock),
        // quantite always represents units; when using conditionnement we keep quantiteConditionnement
        quantite: initialQuantiteUnits,
        prix: defaultPrice,
        montant: defaultPrice * initialQuantiteUnits,
        multiplicateur: multiplicateur,
        // Default to unit input for ventes
        venteParConditionnement: defaultVenteParConditionnement,
        quantiteConditionnement: undefined
      };

      setCart(prev => [...prev, newItem]);
    } catch (error) {
      console.error('Erreur lors de la sélection du produit:', error);
      Swal.fire('Erreur', 'Une erreur est survenue lors de la sélection du produit', 'error');
    }
  };

  const updateQuantity = (uid: string, quantite: number | string) => {
    setCart(prev => prev.map(item => {
      if (item.uid !== uid) return item;
      // only update unit quantity when selling by unit
      if (item.venteParConditionnement) return item;
      const qVal = quantite === '' ? '' : Number(quantite) || 0;
      const newMontant = (Number(qVal) || 0) * (item.prix || 0);
      const updated = { ...item, quantite: qVal as any, montant: newMontant };
      if (process.env.NODE_ENV !== 'production') console.debug('updateQuantity', { uid, quantite, updated });
      return updated;
    }));
  }; 

  const updateConditionnementQuantity = (uid: string, quantiteConditionnement: number) => {
    setCart(prev => prev.map(item => {
      if (item.uid !== uid) return item;
      if (!item.venteParConditionnement) return item;
      const stock = stocks.find(s => s.id === item.id_stock);
      const multiplier = getProduitMultiplicateur(stock);
      const realQ = quantiteConditionnement * (multiplier || 1);
      const newMontant = item.prix * realQ;
      // Keep quantite in units for stock-impact and history
      const updated = { ...item, quantiteConditionnement, quantite: realQ, montant: newMontant };
      if (process.env.NODE_ENV !== 'production') console.debug('updateConditionnementQuantity', { uid, quantiteConditionnement, multiplier, updated });
      return updated;
    }));
  };

  const toggleVenteParConditionnement = (uid: string, venteParConditionnement: boolean) => {
    setCart(prev => prev.map(item => {
      if (item.uid !== uid) return item;
      const stock = stocks.find(s => s.id === item.id_stock);
      const multiplier = getProduitMultiplicateur(stock);
      console.debug('toggleVenteParConditionnement called', { uid, venteParConditionnement, multiplier });
      // initialize quantiteConditionnement to 1 when turning on
      const qCond = venteParConditionnement ? (Number(item.quantiteConditionnement || 1)) : (Number(item.quantite || 1));

      // Business rules:
      // - For Vente: allow unit input; conditionnement only if multiplier>1 (keep existing behavior)
      // - For Achat: default is conditionnement; switching to units is allowed ONLY if multiplier>1 (fractionnable)
      if (isVente) {
        if (venteParConditionnement && (!multiplier || multiplier <= 1)) {
          console.debug('Cannot switch to conditionnement in vente: multiplier missing or <=1', { uid, multiplier });
          return item;
        }
      } else {
        // Achat flows: disallow switching to unit input when product is not fractionnable
        if (!venteParConditionnement && (!multiplier || multiplier <= 1)) {
          Swal.fire('Interdit', 'La saisie à l\'unité n\'est autorisée que si le produit est fractionnable (nombre_unites_par_conditionnement > 1).', 'error');
          return item;
        }
      }

      // Update stored unit quantity when conditionnement changes so stock-impacting quantity is always in units
      const updatedQuantite = venteParConditionnement ? (qCond * (multiplier || 1)) : (Number(item.quantite || 1));
      return { ...item, venteParConditionnement, quantiteConditionnement: venteParConditionnement ? qCond : undefined, quantite: updatedQuantite, montant: item.prix * (updatedQuantite || 0) };
    }));
  };

  const updatePrice = (uid: string, prix: number) => {
    if (isVente) { Swal.fire('Info', 'Le prix est calculé automatiquement pour les ventes (DÉTAIL/GROS) et ne peut pas être modifié manuellement.', 'info'); return; }

    setCart(prev => prev.map(item =>
      item.uid === uid
        ? (item.venteParConditionnement ? (() => { const stock = stocks.find(s => s.id === item.id_stock); const multiplier = stock?.produit?.nombreUnitesParConditionnement || 0; const realQ = (Number(item.quantiteConditionnement || 0)) * multiplier; return { ...item, prix, montant: prix * realQ }; })() : { ...item, prix, montant: prix * (Number(item.quantite) || 0) })
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
      // ensure conditionnement fields are present (support both achat and vente)
      let venteParConditionnement = item.venteParConditionnement;
      let quantiteConditionnement = item.quantiteConditionnement;
      let multiplicateur = item.multiplicateur;
      if (venteParConditionnement === undefined) venteParConditionnement = false;
      if (quantiteConditionnement === undefined) quantiteConditionnement = 1;
      // Recompute multiplicateur if missing or previously zero (handles add-before-stocks-loaded case)
      if (multiplicateur === undefined || multiplicateur <= 1) multiplicateur = getProduitMultiplicateur(stock);

      // determine price (use global priceModeDefault)
      let newPrix = item.prix;
      if (isVente) {
        // prefer the stock's product if available, otherwise try to find a product by produitId across stocks
        const productSource = (stock && stock.produit) ? stock.produit : (item.produitId ? (stocks.find(s => s.produit?.id === item.produitId)?.produit) : undefined);
        if (productSource) {
          const modePrice = getModePriceFromProduct(productSource, priceModeDefault);
          if (modePrice !== undefined && modePrice !== null) newPrix = Number(modePrice);
        }
      }

      const multiplier = (venteParConditionnement && multiplicateur) ? multiplicateur : 1;
      const realQ = venteParConditionnement ? ((Number(quantiteConditionnement) || 0) * multiplier) : (Number(item.quantite) || 0);
      const newMontant = (newPrix || 0) * (realQ || 0);

      return { ...item, prix: newPrix, montant: newMontant, venteParConditionnement, quantiteConditionnement, multiplicateur };
    }));
  }, [priceModeDefault, stocks]);



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
    const realQ = item.venteParConditionnement ? ((Number(item.quantiteConditionnement) || 0) * multiplier) : (Number(item.quantite) || 0);
    const montant = (item.prix || 0) * (realQ || 0);
    return sum + montant;
  }, 0);
  const zeroStockDetails = stocks.filter(stock => (stock.quantiteDisponible ?? 0) === 0);

  const handleSubmit = async () => {


    if (isVente && !selectedClientId) {
      Swal.fire('Erreur', 'Veuillez sélectionner un client', 'error');
      return;
    }


    if (cart.length === 0) {
      Swal.fire('Erreur', 'Le panier est vide', 'error');
      return;
    }

    // Permission guard
    if (isEditMode && !canModifyCommande) { Swal.fire('Accès refusé', 'Vous n\'avez pas la permission de modifier cette commande', 'error'); return; }
    if (!isEditMode && !canCreateCommande) { Swal.fire('Accès refusé', 'Vous n\'avez pas la permission de créer une commande', 'error'); return; }

    // client-side payload building
    const produitsSelectionnes: any[] = [];
    const blockedForStock: number[] = [];
    for (const item of cart) {
      const stock = stocks.find(s => s.id === item.id_stock);
      const multiplier = getProduitMultiplicateur(stock);

      // Client-side validations: ensure quantities make sense
      if (item.venteParConditionnement) {
        if ((Number(item.quantiteConditionnement || 0)) <= 0) {
          Swal.fire('Erreur', `Quantité conditionnement invalide pour ${item.nom}`, 'error');
          return;
        }
      } else {
        if ((Number(item.quantite || 0)) <= 0) {
          Swal.fire('Erreur', `Quantité invalide pour ${item.nom}`, 'error');
          return;
        }
      }

      // For sales, realQ is computed using conditionnement when applicable.
      // For purchases, we always treat quantite as units ordered and do NOT validate stock availability here.
      const realQ = item.venteParConditionnement ? ((Number(item.quantiteConditionnement || 0)) * multiplier) : (Number(item.quantite) || 0);

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
        priceMode: priceModeDefault
      };

      if (item.venteParConditionnement) {
        produitsSelectionnes.push({ ...baseObj, venteParConditionnement: true, quantiteConditionnement: Number(item.quantiteConditionnement) });
      } else {
        produitsSelectionnes.push({ ...baseObj, quantite: Number(item.quantite) });
      }
    }

    if (blockedForStock.length > 0) {
      const labels = blockedForStock.map(id => {
        const it = cart.find(c => c.id_stock === id);
        return it ? `${it.nom} (stockId: ${id})` : `stockId: ${id}`;
      });
      Swal.fire('Erreur', `Stock insuffisant pour : ${labels.join(', ')}`, 'error');
      return;
    }

    // Ensure we send a timezone-aware date to the server (include local offset)
    const dateCommandeWithOffset = (() => {
      if (!dateCommande) return null;
      const m = dateCommande.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/);
      const pad = (n:number) => n.toString().padStart(2, '0');
      if (m) {
        const [, datePart, hh, mm] = m;
        // compute offset for client's local timezone
        const dt = new Date(`${datePart}T${hh}:${mm}:00`);
        const offsetMin = -dt.getTimezoneOffset(); // minutes ahead of UTC
        const sign = offsetMin >= 0 ? '+' : '-';
        const oh = Math.floor(Math.abs(offsetMin) / 60);
        const om = Math.abs(offsetMin) % 60;
        return `${datePart}T${hh}:${mm}${sign}${pad(oh)}:${pad(om)}`;
      }
      return dateCommande;
    })();

    const payload: any = isEditMode && id
      ? {
          reference,
          dateCommande: dateCommandeWithOffset || dateCommande,
          total,
          paie: 0,
          client: { id: selectedClientId },
          produitsSelectionnes
        }
      : {
          reference,
          dateVente: dateCommandeWithOffset || dateCommande,
          client: selectedClientId ? { id: selectedClientId } : undefined,
          produitsSelectionnes,
          total
        };

    try {
      const token = localStorage.getItem('smb_token');
      let url: string;
      let method: string;
      if (isEditMode && id) {
        // Edit existing vente stored as CommandeClient
        url = `${API}/commandes-clients/${id}`;
        method = 'PUT';
      } else {
        // Create new vente (full)
        url = `${API}/ventes/full`;
        method = 'POST';
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
      setSelectedClientId(null);
      generateReference();
      if (isEditMode) {
        // navigate back to listes after edit
        navigate('/liste-commandes?mode=vente');
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

      // Quick client-side expiry check
      if (isTokenExpired(token)) {
        Swal.fire('Session expirée', 'Votre session a expiré. Veuillez vous reconnecter.', 'warning');
        try { logout(); } catch (e) {}
        return;
      }

      // Séparation stricte : ce composant sert la vente au comptoir -> endpoint ventes uniquement
      const tryEndpoints = [
        { path: `${API}/ventes/${idToOpen}/pdf`, label: 'ventes' }
      ];

      let lastError: any = null;
      for (const ep of tryEndpoints) {
        try {
          const res = await fetch(ep.path, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
          if (res.status === 401) {
            // collect server response body for diagnostics (do not expose token)
            const body = await res.json().catch(() => null);
            console.debug('openPdfPrint 401 body:', body);

            // Optionally hit a lightweight auth-check endpoint to confirm token acceptance
            try {
              const check = await fetch(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } });
              console.debug('auth check /api/users status:', check.status);
              if (check.status === 401) {
                Swal.fire('Session expirée', 'Authentification requise. Vous allez être redirigé vers la page de connexion.', 'warning');
                try { logout(); } catch (e) {}
                navigate('/login');
                return;
              }
            } catch (e) { console.debug('auth check failed', e); }

            lastError = `Endpoint ${ep.label} returned 401: ${body && body.message ? body.message : 'Unauthorized'}`;
            console.debug('openPdfPrint:', lastError);
            continue; // try next endpoint
          }
          const text = await res.text().catch(() => '');
          if (res.ok) {
            // convert text to blob only when successful? we consumed text; need blob separately. Re-fetch as blob.
            const blobRes = await fetch(ep.path, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
            if (!blobRes.ok) { lastError = `Endpoint ${ep.label} second fetch failed: ${blobRes.status} ${blobRes.statusText}`; console.debug('openPdfPrint blob fetch error:', lastError); continue; }
            const blob = await blobRes.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            return;
          }
          lastError = `Endpoint ${ep.label} returned ${res.status} ${res.statusText}: ${text}`;
          console.debug('openPdfPrint:', lastError);
        } catch (e: any) {
          lastError = `Fetch to ${ep.label} failed: ${e.message}`;
          console.debug('openPdfPrint:', lastError);
        }
      }
      Swal.fire('Erreur', `Impossible de charger le PDF. Détails: ${lastError}`, 'error');
      return;

      // Default: commande fournisseur
      try {
        const res = await fetch(`${API}/commandes-fournisseurs/${idToOpen}/pdf`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401) {
          await Swal.fire('Session expirée', 'Authentification requise. Vous allez être redirigé vers la page de connexion.', 'warning');
          navigate('/login');
          return;
        }
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
              <h5>Commande Client</h5>
            </div>
            <div className="card-body">
              {/* Breadcrumb */}
              <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
                <div className="breadcrumb-title pe-3">Commande</div>
                <div className="ps-3">
                  <nav aria-label="breadcrumb">
                    <ol className="breadcrumb mb-0 p-0">
                      <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
                      <li className="breadcrumb-item active" aria-current="page">Commande Client</li>
                    </ol>
                  </nav>
                </div> 
                <div className="ms-auto">
                  <div className="btn-group">
                    <button className="btn btn-outline-primary mb-3 mb-lg-0 me-2" onClick={() => navigate('/liste-commandes?mode=vente')}>
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
                  <div className="col-md-2">
                    <label>Mode de prix</label>
                    <div className="form-check form-switch">
                      <input className="form-check-input" id="priceModeToggle" type="checkbox" checked={priceModeDefault === 'DETAIL'} onChange={(e) => setPriceModeDefault(e.target.checked ? 'DETAIL' : 'GROS')} />
                      <label className="form-check-label" htmlFor="priceModeToggle">{priceModeDefault === 'DETAIL' ? 'DÉTAIL' : 'GROS'}</label>
                    </div>
                  </div>
                <div className="col-md-3">
                    <label>Client
                      <RequirePermission permission="CLIENT_CREER" fallback={<button type="button" className="btn btn-sm btn-outline-secondary ms-2" disabled title="Permission requise"><i className='bx bx-plus'></i> Ajouter</button>}>
                        <button type="button" className="btn btn-sm btn-outline-success ms-2" onClick={() => { setNewClient({}); setClientSearch(''); setShowClientModal(true); }}>
                          <i className='bx bx-plus'></i> Ajouter
                        </button>
                      </RequirePermission>
                    </label>
                    <select className="form-control" value={selectedClientId ?? ''} onChange={(e) => { const v = e.target.value; setSelectedClientId(v ? parseInt(v) : null); }}>
                      <option value="">Sélectionner un client</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.prenom} {c.nom} - {c.contact}</option>
                      ))}
                    </select>
              </div>
              </div>

              <div className="row">
                <div className="col-6">
                  <div className="card">
                    <div className="card-header bg-primary text-white">
                      <h6>Produits disponibles</h6>
                    </div>

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
                            <label className="form-label small mb-1 visually-hidden">Sélectionner un produit</label>
                            <SearchableSelect
                              options={stocks.map((stock) => {
                                const mult = getProduitMultiplicateur(stock);
                                const unitLabel = (stock?.produit as any)?.unite?.libelle ?? 'carton';
                                const multLabel = mult > 1 ? ` - ${mult}u/${unitLabel}` : '';
                                const price = stock.produit?.prixAchat ?? 0;
                                const prodName = getProductDisplayName(stock);
                                const multPart = (mult && mult > 1) ? ` — 1 ${unitLabel} = ${mult} unités` : '';
                                const depotLabel = (locationType === 'MAGASIN') ? (stock.magasin?.nom || stock.magasin?.nomMagasin || String(stock.magasin?.magasinId || '') || 'Dépôt magasin') : (currentBoutique?.nom || stock.boutique?.nom || 'Dépôt boutique');
                                return {
                                  value: stock.id,
                                  label: `${prodName}${multLabel} - ${fmt(Number(price))}${multPart} — Stock : ${formatPackaging(stock.quantiteDisponible || 0, mult)}`,
                                  depot: depotLabel
                                };
                              })}
                              value={selectedStockOption}
                              onChange={(val) => {
                                setSelectedStockOption(val);
                                if (val !== null) {
                                  handleProductSelect(String(val));
                                  setTimeout(() => setSelectedStockOption(null), 0);
                                }
                              }}
                              placeholder="Sélectionner un produit"
                              allowClear={true}
                            />
                          </div>
                        </div>
                        <div className="d-flex flex-column flex-sm-row justify-content-end gap-2 mt-2">
                          <button 
                            className="btn btn-outline-secondary btn-sm"
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
                                    <small className="text-muted">{fmt(Number(stock.produit?.prixAchat ?? 0))}</small>
                                  </div>
                                  <div>
                                    <span className="badge bg-primary me-1">{stock.magasin?.nom || stock.magasin?.nomMagasin || stock.magasin?.magasinId || 'Dépôt boutique'}</span>
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
                <div className="col-6">
                  <div className="card">
                    <div className="card-header bg-primary text-white">
                      <h6>Panier</h6>
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
                            const realQ = item.venteParConditionnement ? ((Number(item.quantiteConditionnement) || 0) * multiplier) : (Number(item.quantite) || 0);
                            const montant = (item.prix || 0) * (realQ || 0);
                            return (
                              <tr key={item.uid}>
                                <td>{item.nom}</td>
                                <td>
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        {!item.venteParConditionnement ? (() => { const unitLabelForUnits = (stock?.produit as any)?.unite?.libelle ?? 'u'; return (<><label className="small">Qté ({unitLabelForUnits})</label>
                                        <input
                                          id={`qty_${item.uid}`}
                                          type="number"
                                          className="form-control"
                                          value={item.quantite ?? ''}
                                          min="1"
                                          placeholder={`ex: 6`}
                                          onChange={(e) => updateQuantity(item.uid, e.target.value === '' ? '' : parseInt(e.target.value) || 1)}
                                          style={{ width: 100 }}
                                        />
                                        </>); })() : null}

                                        <div className="form-check form-check-inline" style={{ marginLeft: 8 }}>
                                          <input className="form-check-input" type="checkbox" id={`vente_cond_${item.uid}`} checked={!!item.venteParConditionnement} onChange={(e) => toggleVenteParConditionnement(item.uid, e.target.checked)} disabled={multiplier <= 1} />
                                          {(() => { const unitLabelRaw = ((stock?.produit as any)?.unite?.libelle) ?? 'emballage'; const unitLabel = typeof unitLabelRaw === 'string' ? unitLabelRaw : String(unitLabelRaw); return <label className="form-check-label small" htmlFor={`vente_cond_${item.uid}`}>Par {unitLabel} {multiplier > 1 ? `(${multiplier}u)` : ''}</label>; })()} 
                                        </div> 

                                        {item.venteParConditionnement ? (
                                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            {(() => { const unitLabelRaw = ((stock?.produit as any)?.unite?.libelle) ?? 'carton'; const unitLabel = typeof unitLabelRaw === 'string' ? unitLabelRaw : String(unitLabelRaw); return (<><label className="small">Qté ({unitLabel})</label><input type="number" className="form-control" value={item.quantiteConditionnement ?? 1} min={1} onChange={(e) => updateConditionnementQuantity(item.uid, parseInt(e.target.value) || 1)} style={{ width: 80 }} disabled={multiplier <= 1} /></>); })()} 
                                            <div className="text-muted small">{`${Number(item.quantiteConditionnement || 0)} ${(((stock?.produit as any)?.unite?.libelle) ?? 'carton')}${((Number(item.quantiteConditionnement || 0)) > 1 && !((((stock?.produit as any)?.unite?.libelle) ?? 'carton') as string).toLowerCase().endsWith('s') ? 's' : '')} ≈ ${((Number(item.quantiteConditionnement || 0)) * multiplier)} unités`}</div>
                                            <div className="text-muted small">1 {((stock?.produit as any)?.unite?.libelle) ?? 'carton'} = {multiplier} u</div>
                                            <button type="button" className="btn btn-link btn-sm" onClick={() => { toggleVenteParConditionnement(item.uid, false); setTimeout(() => { const el = document.getElementById(`qty_${item.uid}`) as HTMLInputElement | null; if (el) el.focus(); }, 60); }}>Saisir en unités</button>
                                          </div>
                                        ) : ( 
                                          (() => {
                                            if (!stock) return <div style={{ marginLeft: 6 }} className="text-muted small">{`${Number(item.quantite || 0)} unité${(Number(item.quantite || 0) > 1) ? 's' : ''}`}</div>;
                                            const prodId = item.produitId;
                                            const cartUnits = getCartUnitsForProduct(prodId);
                                            const stockAfter = (stock.quantiteDisponible || 0) - cartUnits;
                                            const mult = getProduitMultiplicateur(stock);
                                            if (mult > 1) {
                                              const full = Math.floor(stockAfter / mult);
                                              const rem = ((stockAfter % mult) + mult) % mult; // ensure non-negative
                                              if (rem > 0) return <div className="text-muted small">{`Carton ouvert — reste ${rem} unité${rem > 1 ? 's' : ''} dans le carton`}</div>;
                                              return <div className="text-muted small">{`${stockAfter} unités (${full} carton${full > 1 ? 's' : ''})`}</div>;
                                            }
                                            return <div className="text-muted small">{`${stockAfter} unité${stockAfter > 1 ? 's' : ''}`}</div>;
                                          })()
                                        )} 
                                  </div>
                                </div>
                                </td>
                                <td>
                                  <div className="input-group input-group-sm">

                                    <input
                                      type="number"
                                      className="form-control"
                                      value={item.prix}
                                      min="0"
                                      step="0.01"
                                      onChange={(e) => updatePrice(item.uid, parseFloat(e.target.value) || 0)}
                                      style={{ width: 160, fontSize: '1rem' }}
                                      disabled={true}
                                    />
                                    {(() => {
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
                                <td>{fmt(montant)}</td>
                                <td>
                                  <div className="d-flex">
                                    <RequirePermission permission={[ 'COMMANDE_MODIFIER', 'COMMANDE_CREER' ]}>
                                      <button className="btn btn-danger btn-sm" onClick={() => removeFromCart(item.uid)} title="Supprimer">
                                        <i className="bx bx-trash"></i>
                                      </button>
                                    </RequirePermission>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3} className="text-end fw-bold">Total :</td>
                            <td className="fw-bold">{fmt(total)}</td>
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
                <div className="col-12 text-center">
                  {cart.length > 0 && (
                    <RequirePermission permission={isEditMode ? 'COMMANDE_MODIFIER' : 'COMMANDE_CREER'} fallback={<button className="btn btn-secondary" disabled title="Permission requise">{isEditMode ? 'Modifier la commande' : 'Passer la commande'}</button>}>
                      <button className="btn btn-primary" onClick={handleSubmit}>
                        {isEditMode ? 'Modifier la commande' : 'Passer la commande'}
                      </button>
                    </RequirePermission>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Client add/select modal (rendered as a portal to document.body to avoid stacking issues) */}
      {showClientModal && createPortal(
        <div className="modal show d-block" tabIndex={-1} role="dialog" style={{ zIndex: 2000 }}>
          <div className="modal-backdrop fade show" style={{ zIndex: 1999 }}></div>
          <div className="modal-dialog modal-lg modal-dialog-centered modal-fullscreen-sm-down" role="document" style={{ zIndex: 2001 }}>
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
                      <PhoneWithDial value={newClient.contact || ''} defaultCountry={(currentBoutique && (currentBoutique as any).pays && (currentBoutique as any).pays.codeIso) ? (currentBoutique as any).pays.codeIso : 'ML'} onChange={(tel, code, valid) => { setNewClient(prev => ({ ...prev, contact: tel || '' })); setNewClientCodePays(code || null); setNewClientTelephoneValid(typeof valid === 'boolean' ? valid : null); }} />
                    </div>
                    <div className="mb-2">
                      <input className="form-control" placeholder="Ville" value={newClient.ville || ''} onChange={(e) => setNewClient({ ...newClient, ville: e.target.value })} />
                    </div>

                    <div className="d-flex justify-content-end mt-3">
                      <button className="btn btn-secondary me-2" onClick={() => { setNewClient({}); setClientSearch(''); setShowClientModal(false); }}>Annuler</button>
                      <button className="btn btn-success" onClick={async () => {
                        if (!canCreateClient) { Swal.fire('Accès refusé', 'Vous n\'avez pas la permission de créer un client', 'error'); return; }
                        // validate phone
                        if (newClient.contact && newClient.contact.trim() && newClientTelephoneValid !== true) { Swal.fire('Erreur', 'Le numéro de téléphone du client est invalide ou incomplet pour le pays associé', 'error'); return; }
                        try {
                          const token = localStorage.getItem('smb_token');
                          if (!token) {
                            // Close the client modal first so backdrop is removed, then show session message and logout
                            setShowClientModal(false);
                            await Swal.fire('Session expirée', 'Authentification requise. Vous allez être redirigé vers la connexion.', 'error');
                            try { logout(); } catch (e) {}
                            return;
                          }

                          // If token looks expired on the client, avoid calling the API and logout early with a clearer message
                          if (isTokenExpired(token)) {
                            setShowClientModal(false);
                            await Swal.fire('Session expirée', 'Votre session a expiré. Connectez-vous à nouveau.', 'warning');
                            try { logout(); } catch (e) {}
                            return;
                          }
                          const payload: any = { prenom: newClient.prenom, nom: newClient.nom, contact: newClient.contact, ville: newClient.ville, codePays: newClientCodePays || undefined };
                          // debug: log token existence (do NOT leave this log in production)
                          console.debug('create-client token-present', !!token);
                          const res = await fetch(`${API}/clients-grossistes`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify(payload)
                          });
                          if (res.status === 401) {
                            // Close modal so the backdrop is removed before showing session message
                            setShowClientModal(false);
                            await Swal.fire('Session expirée', 'Authentification requise. Vous allez être redirigé vers la connexion.', 'error');
                            try { logout(); } catch (e) {}
                            return;
                          }
                          if (res.status === 403) {
                            // Do not logout on forbidden; surface a permission error
                            const errBody = await res.json().catch(() => null);
                            await Swal.fire('Accès refusé', errBody && errBody.message ? errBody.message : 'Vous n\'avez pas la permission de créer un client', 'error');
                            return;
                          }
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
  );
};

export default CommandeClient;
