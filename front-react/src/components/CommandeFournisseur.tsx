import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import SearchableSelect from './SearchableSelect';
import { toDatetimeLocalInput } from '../utils/date';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import useHasPermission from '../contexts/useHasPermission';
import { useFormatMoney } from '../utils/currency';
import RequirePermission from './RequirePermission';
import PhoneWithDial from './PhoneWithDial';
import { useUser } from '../contexts/UserContext';
import { API } from '../config/api';

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

const CommandeFournisseur: React.FC = () => {
  const navigate = useNavigate();
  const fmt = useFormatMoney();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedFournisseur, setSelectedFournisseur] = useState('');
  // Vente mode: client name instead of fournisseur


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

  // prettyJson helper removed (unused)

  // inspectStock helper removed (unused)

  // Fournisseur modal state
  const [showFournisseurModal, setShowFournisseurModal] = useState(false);
  const [newFournisseur, setNewFournisseur] = useState<{ prenom?: string; nom?: string; contact?: string; ville?: string }>({});
  const [fournisseurSearch, setFournisseurSearch] = useState('');
  // Phone handling for new fournisseur (same behaviour as client modal)
  const [newFournisseurCodePays, setNewFournisseurCodePays] = useState<string | null>(null);
  const [newFournisseurTelephoneValid, setNewFournisseurTelephoneValid] = useState<boolean | null>(null);



  // Permissions
  const canCreateCommande = useHasPermission('COMMANDE_CREER');
  const canModifyCommande = useHasPermission('COMMANDE_MODIFIER');
  const canCreateFournisseur = useHasPermission('FOURNISSEUR_CREER');
  // user context (for logout and boutique defaults)
  const { logout, currentBoutique } = useUser();

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
        const res = await fetch(`${API}/magasins/${idToUse}/stocks`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
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
        // Default selection rules for achat: prefer MAGASIN if exists
        if (mags && mags.length > 0) {
          setLocationType('MAGASIN');
          setSelectedMagasinId(mags[0].id);
          await fetchStocksByLocation('MAGASIN', mags[0].id);
        } else {
          setLocationType('BOUTIQUE');
          await fetchStocksByLocation('BOUTIQUE');
        }

        await fetchFournisseurs();
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

  // Ensure body class and scrolling behavior while modal is open
  useEffect(() => {
    if (showFournisseurModal) document.body.classList.add('modal-open'); else document.body.classList.remove('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [showFournisseurModal]);

  const fetchCommandeForEdit = async (commandeId: number, loadedStocks?: Stock[]) => {
    try {
      const token = localStorage.getItem('smb_token');
      let res = null as any;
      res = await fetch(`${API}/commandes-fournisseurs/${commandeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors du chargement de la commande');
      const data = await res.json();
      // populate form
      setReference(data.reference || '');
      // convert server date to yyyy-MM-ddTHH:mm (without timezone shift)
      if (data.dateCommande) {
        setDateCommande(toDatetimeLocalInput(data.dateCommande));
      }
      // Populate fournisseur for achat
      setSelectedFournisseur(data.fournisseur?.id ? String(data.fournisseur.id) : '');
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
    const prefix = 'CMF';
    const ref = `${prefix}-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    setReference(ref);
  };







  const fetchFournisseurs = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`${API}/fournisseurs`, {
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

      // Prix par défaut = prix d'achat catalogue; on ne reprend le dernier prix saisi que si le catalogue n'a pas de valeur
      let defaultPrice = Number(stock.produit?.prixAchat ?? 0);
      if (stock.produit) {
        const lastPriceKey = `lastPrice_${stock.produit.id}`;
        const lastPriceRaw = localStorage.getItem(lastPriceKey);
        const lastPrice = lastPriceRaw ? parseFloat(lastPriceRaw) : NaN;
        // Ne pas écraser un prix catalogue valide par un ancien prix saisi; ne prendre l'historique qu'en absence de prix catalogue
        if ((!defaultPrice || defaultPrice <= 0) && !isNaN(lastPrice) && lastPrice > 0) {
          defaultPrice = lastPrice;
        }
      }

      if (defaultPrice <= 0) {
        Swal.fire('Attention', 'Le prix de ce produit n\'est pas défini. Veuillez le saisir manuellement.', 'warning');
      }

      const multiplicateur = getProduitMultiplicateur(stock);
      // Default behaviour for achats: prefer saisie par conditionnement only when product has multiple units per package (e.g., carton)
      const defaultVenteParConditionnement = multiplicateur > 1;
      const initialQuantiteConditionnement = 1;
      const initialQuantiteUnits = (multiplicateur && multiplicateur > 0) ? (multiplicateur * initialQuantiteConditionnement) : 1;
      const newItem: CartItem = {
        uid: nextUid(),
        id_stock: stock.id,
        produitId: stock.produit?.id,
        nom: getProductDisplayName(stock),
        // quantite always represents units; when using conditionnement we keep quantiteConditionnement
        quantite: defaultVenteParConditionnement ? initialQuantiteUnits : 1,
        prix: defaultPrice,
        montant: defaultPrice * (defaultVenteParConditionnement ? initialQuantiteUnits : 1),
        multiplicateur: multiplicateur,
        // Default to conditionnement for achats, unit for ventes
        venteParConditionnement: defaultVenteParConditionnement,
        quantiteConditionnement: initialQuantiteConditionnement
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
      const qCond = venteParConditionnement ? (item.quantiteConditionnement || 1) : item.quantite;

      // Allow switching between conditionnement and unit input for purchases. Single-unit products (multiplier<=1) will default to unit input.

      // Update stored unit quantity when conditionnement changes so stock-impacting quantity is always in units
      const updatedQuantite = venteParConditionnement ? (qCond * (multiplier || 1)) : (item.quantite || 1);
      return { ...item, venteParConditionnement, quantiteConditionnement: venteParConditionnement ? qCond : undefined, quantite: updatedQuantite, montant: item.prix * (updatedQuantite || 0) };
    }));
  };

  const updatePrice = (uid: string, prix: number) => {
    setCart(prev => prev.map(item =>
      item.uid === uid
        ? (item.venteParConditionnement ? (() => { const stock = stocks.find(s => s.id === item.id_stock); const multiplier = stock?.produit?.nombreUnitesParConditionnement || 0; const realQ = (item.quantiteConditionnement || 0) * multiplier; return { ...item, prix, montant: prix * realQ }; })() : { ...item, prix, montant: prix * item.quantite })
        : item
    ));

    // Save last used price for this product in localStorage
    const item = cart.find(i => i.uid === uid);
    const stock = item ? stocks.find(s => s.id === item.id_stock) : undefined;
    if (stock && stock.produit) {
      const lastPriceKey = `lastPrice_${stock.produit.id}`;
      localStorage.setItem(lastPriceKey, prix.toString());
    }
  }; 

  // Normalize cart entries and recompute montants when stocks change
  useEffect(() => {
    setCart(prev => prev.map(item => {
      const stock = stocks.find(s => s.id === item.id_stock);
      let venteParConditionnement = item.venteParConditionnement;
      let quantiteConditionnement = item.quantiteConditionnement;
      let multiplicateur = item.multiplicateur;
      if (venteParConditionnement === undefined) venteParConditionnement = false;
      if (quantiteConditionnement === undefined) quantiteConditionnement = 1;
      if (multiplicateur === undefined || multiplicateur <= 1) multiplicateur = getProduitMultiplicateur(stock);

      const multiplier = (venteParConditionnement && multiplicateur) ? multiplicateur : 1;
      const realQ = venteParConditionnement ? ((quantiteConditionnement || 0) * multiplier) : item.quantite;
      const newMontant = (item.prix || 0) * (realQ || 0);

      return { ...item, montant: newMontant, venteParConditionnement, quantiteConditionnement, multiplicateur };
    }));
  }, [stocks]);



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
    if (!selectedFournisseur) {
      Swal.fire('Erreur', 'Veuillez sélectionner un fournisseur', 'error');
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
        if (!item.quantiteConditionnement || item.quantiteConditionnement <= 0) {
          Swal.fire('Erreur', `Quantité conditionnement invalide pour ${item.nom}`, 'error');
          return;
        }
      } else {
        if (!item.quantite || item.quantite <= 0) {
          Swal.fire('Erreur', `Quantité invalide pour ${item.nom}`, 'error');
          return;
        }
      }




      // Build selection object and include ligneId / produitId to help backend map existing lignes when editing
      const baseObj: any = {
        id_stock: item.id_stock,
        produitId: item.produitId || undefined,
        ligneId: item.ligneId || undefined,
        prix: item.prix
      }; 

      // Achat flows: always send unit quantity for stock impact (quantite in units)
      if (item.venteParConditionnement) {
        const units = (item.quantiteConditionnement || 0) * (multiplier || 1);
        produitsSelectionnes.push({ ...baseObj, quantite: units, quantiteConditionnement: item.quantiteConditionnement });
      } else {
        produitsSelectionnes.push({ ...baseObj, quantite: item.quantite });
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

    const payload = {
      reference,
      dateCommande,
      fournisseur: { id: parseInt(selectedFournisseur) },
      produitsSelectionnes,
      total
    };

    try {
      const token = localStorage.getItem('smb_token');
      let url = isEditMode && id ? `${API}/commandes-fournisseurs/${id}` : `${API}/commandes-fournisseurs`;
      let method = isEditMode && id ? 'PUT' : 'POST';

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
      if (!token) {
        Swal.fire('Erreur', 'Authentification nécessaire. Connectez-vous.', 'error');
        return;
      }


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
                <div className="col-md-3">
                  <label>Date et Heure</label>
                  <input type="datetime-local" className="form-control" value={dateCommande} readOnly />
                </div>

                <div className="col-md-3">
                <>
                    <label>Fournisseur
                      <RequirePermission permission="FOURNISSEUR_CREER" fallback={<button type="button" className="btn btn-sm btn-outline-secondary ms-2" disabled title="Permission requise"><i className='bx bx-plus'></i> Ajouter</button>}>
                        <button type="button" className="btn btn-sm btn-outline-success ms-2" onClick={() => { setNewFournisseur({}); setFournisseurSearch(''); setShowFournisseurModal(true); }}>
                          <i className='bx bx-plus'></i> Ajouter
                        </button>
                      </RequirePermission>
                    </label>
                    <select className="form-control" value={selectedFournisseur} onChange={(e) => setSelectedFournisseur(e.target.value)}>
                      <option value="">Sélectionner un fournisseur</option>
                      {fournisseurs.map(f => (
                        <option key={f.id} value={f.id}>{f.prenom} {f.nom}</option>
                      ))}
                    </select>
                  </>
              </div>
              </div>

              <div className="row">
                <div className="col-md-6">
                  <div className="card">
                    <div className="card-header bg-primary text-white">
                      <h6>Produits disponibles</h6>
                    </div>
                    <div className="card-body">
                      <div className="row gy-2 gx-3 align-items-end">
                        <div className="col-12 col-sm-4">
                          <label className="form-label small mb-1 text-muted">Dépôt / Emplacement</label>
                          <select
                            className="form-select form-select-sm"
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
                        </div>
                        <div className="col-12 col-sm-8">
                          <label className="form-label small mb-1 visually-hidden">Sélectionner un produit</label>
                          <SearchableSelect
                            options={stocks.map((stock) => {
                              const mult = getProduitMultiplicateur(stock);
                              const unitLabel = (stock?.produit as any)?.unite?.libelle ?? 'carton';
                              const multLabel = mult > 1 ? ` - ${mult}u/${unitLabel}` : ''; 
                              const price = stock.produit?.prixAchat ?? 0;
                              return {
                                value: stock.id,
                                label: (() => {
                                  const prodName = getProductDisplayName(stock);
                                  const mult = getProduitMultiplicateur(stock);
                                  const unitLabel = (stock?.produit as any)?.unite?.libelle ?? 'conditionnement';
                                  const multPart = mult && mult > 1 ? ` — 1 ${unitLabel} = ${mult} unités` : '';
                                  return `${prodName}${multLabel} - ${fmt(Number(price))} - ${stock.magasin?.nom || 'Dépôt boutique'}${multPart} — Stock : ${stock.quantiteDisponible || 0} unités`;
                                })()
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
                      <div className="d-flex justify-content-end gap-2 mt-2">
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
                                    <span className="badge bg-primary me-1">{stock.magasin?.nom || 'Dépôt boutique'}</span>
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
                            const realQ = item.venteParConditionnement ? ((item.quantiteConditionnement || 0) * multiplier) : item.quantite;
                            const montant = (item.prix || 0) * (realQ || 0);
                            return (
                              <tr key={item.uid}>
                                <td>{item.nom}</td>
                                <td>
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <label className="small">Qté</label>
                                        <input
                                          type="number"
                                          className="form-control"
                                          value={item.quantite}
                                          min="1"
                                          onChange={(e) => updateQuantity(item.uid, parseInt(e.target.value) || 1)}
                                          style={{ width: 80 }}
                                          disabled={!!item.venteParConditionnement}
                                        />

                                        <div className="form-check form-check-inline" style={{ marginLeft: 8 }}>
                                          <input className="form-check-input" type="checkbox" id={`achat_cond_${item.uid}`} checked={!!item.venteParConditionnement} onChange={(e) => toggleVenteParConditionnement(item.uid, e.target.checked)} disabled={multiplier <= 1} />
                                          {(() => { const unitLabel = ((stock?.produit as any)?.unite?.libelle) ?? 'carton'; return <label className="form-check-label small" htmlFor={`achat_cond_${item.uid}`}>Par {unitLabel} {multiplier > 1 ? `(${multiplier}u)` : ''}</label>; })()} 
                                        </div>

                                        {item.venteParConditionnement ? (
                                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            {(() => { const unitLabel = ((stock?.produit as any)?.unite?.libelle) ?? 'carton'; return (<><label className="small">Qté ({unitLabel})</label><input type="number" className="form-control" value={item.quantiteConditionnement ?? 1} min={1} onChange={(e) => updateConditionnementQuantity(item.uid, parseInt(e.target.value) || 1)} style={{ width: 80 }} disabled={multiplier <= 1} /></>); })()} 
                                            <div className="text-muted small">1 {((stock?.produit as any)?.unite?.libelle) ?? 'carton'} = {multiplier} u</div>
                                          </div>
                                        ) : null}
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
      {/* Fournisseur add/select modal (rendered as a portal to document.body to avoid stacking issues) */}
      {showFournisseurModal && createPortal(
        <div className="modal show d-block" tabIndex={-1} role="dialog" style={{ zIndex: 2000 }}>
          <div className="modal-backdrop fade show" style={{ zIndex: 1999 }}></div>
          <div className="modal-dialog modal-lg modal-dialog-centered modal-fullscreen-sm-down" role="document" style={{ zIndex: 2001 }}>
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
                      <PhoneWithDial value={newFournisseur.contact || ''} defaultCountry={(currentBoutique && (currentBoutique as any).pays && (currentBoutique as any).pays.codeIso) ? (currentBoutique as any).pays.codeIso : 'ML'} onChange={(tel, code, valid) => { setNewFournisseur({ ...newFournisseur, contact: tel }); setNewFournisseurCodePays(code || null); setNewFournisseurTelephoneValid(typeof valid === 'boolean' ? valid : null); }} />
                    </div>
                    <div className="mb-2">
                      <input className="form-control" placeholder="Ville" value={newFournisseur.ville || ''} onChange={(e) => setNewFournisseur({ ...newFournisseur, ville: e.target.value })} />
                    </div>

                    <div className="d-flex justify-content-end mt-3">
                      <button className="btn btn-secondary me-2" onClick={() => { setNewFournisseur({}); setFournisseurSearch(''); setShowFournisseurModal(false); }}>Annuler</button>
                      <button className="btn btn-success" onClick={async () => {
                        if (!canCreateFournisseur) { Swal.fire('Accès refusé', 'Vous n\'avez pas la permission de créer un fournisseur', 'error'); return; }
                        // validate phone
                        if (newFournisseur.contact && newFournisseur.contact.trim() && newFournisseurTelephoneValid !== true) { Swal.fire('Erreur', 'Le numéro de téléphone du fournisseur est invalide ou incomplet pour le pays associé', 'error'); return; }
                        // Create new fournisseur via API (with session checks similar to client modal)
                        try {
                          const token = localStorage.getItem('smb_token');
                          if (!token) {
                            setShowFournisseurModal(false);
                            await Swal.fire('Session expirée', 'Authentification requise. Vous allez être redirigé vers la connexion.', 'error');
                            try { logout(); } catch (e) {}
                            return;
                          }

                          if (isTokenExpired(token)) {
                            setShowFournisseurModal(false);
                            await Swal.fire('Session expirée', 'Votre session a expiré. Connectez-vous à nouveau.', 'warning');
                            try { logout(); } catch (e) {}
                            return;
                          }

                          const payload: any = { prenom: newFournisseur.prenom, nom: newFournisseur.nom, contact: newFournisseur.contact, ville: newFournisseur.ville, codePays: newFournisseurCodePays || undefined };
                          const res = await fetch(`${API}/fournisseurs`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify(payload)
                          });

                          if (res.status === 401) {
                            setShowFournisseurModal(false);
                            await Swal.fire('Session expirée', 'Authentification requise. Vous allez être redirigé vers la connexion.', 'error');
                            try { logout(); } catch (e) {}
                            return;
                          }
                          if (res.status === 403) {
                            const errBody = await res.json().catch(() => null);
                            await Swal.fire('Accès refusé', errBody && errBody.message ? errBody.message : 'Vous n\'avez pas la permission de créer un fournisseur', 'error');
                            return;
                          }

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
    </div>
  );
};

export default CommandeFournisseur;