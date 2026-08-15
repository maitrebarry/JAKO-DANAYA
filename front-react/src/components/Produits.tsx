import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useUser } from '../contexts/UserContext';
import useHasPermission from '../contexts/useHasPermission';
import RequirePermission from './RequirePermission';
import { useFormatMoney } from '../utils/currency';
import { withApi, API, API_BASE } from '../config/api';
import { createEmballage, updateEmballage, deleteEmballage } from '../api/produits';
import '../assets/css/style_produit.css';

interface EmballageRow {
  tempId: string;
  id?: number;
  uniteId: string;
  nombreUnites: string;
  estParDefaut: boolean;
}

const Produits: React.FC = () => {
  const navigate = useNavigate();
  const { currentBoutique } = useUser();
  const fmt = useFormatMoney();
  const [margeConfig, setMargeConfig] = useState<any | null>(null);

  const [produits, setProduits] = useState<any[]>([]);
  const [unites, setUnites] = useState<any[]>([]);
  const [magasins, setMagasins] = useState<any[]>([]);
  const [selectedMagasins, setSelectedMagasins] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  // Assignation UI state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSelectedMagasin, setAssignSelectedMagasin] = useState<number | null>(null);
  const [assignSelectedProductIds, setAssignSelectedProductIds] = useState<number[]>([]);
  const [assignSelectAll, setAssignSelectAll] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [error, setError] = useState('');
  const [assignExistingProductIds, setAssignExistingProductIds] = useState<number[]>([]);
  const [assignSuccess, setAssignSuccess] = useState(false);

  // profit modal state + helper
  const [showProfitModal, setShowProfitModal] = useState(false);
  const [profitTotals, setProfitTotals] = useState({ totalAchat: 0, totalDetail: 0, totalGros: 0 });
  const computeProfitForBoutique = (list: any[]) => {
    let tA = 0, tD = 0, tG = 0;
    for (const p of list) {
      const qty = (p.quantiteInitialeConditionnements !== undefined && p.quantiteInitialeConditionnements !== null)
        ? (p.quantiteInitialeConditionnements * (p.nombreUnitesParConditionnement || 1))
        : (p.quantiteInitiale || 0);
      if (!qty || qty <= 0) continue;
      tA += qty * (p.prixAchat || 0);
      tD += qty * (p.prixDetail || 0);
      tG += qty * (p.prixEnGros || p.prixGros || 0);
    }
    return { totalAchat: tA, totalDetail: tD, totalGros: tG };
  };


  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importPhase, setImportPhase] = useState<string>('');
  const [importImagesDone, setImportImagesDone] = useState<number | null>(null);
  const [importImagesTotal, setImportImagesTotal] = useState<number | null>(null);
  const [importProcessedCount, setImportProcessedCount] = useState<number | null>(null);
  const [importTotalRows, setImportTotalRows] = useState<number | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [createMissingUnits, setCreateMissingUnits] = useState<boolean>(true);
  const [detailProduit, setDetailProduit] = useState<any>(null);
  const [newProduit, setNewProduit] = useState({
    nomProduit: '',
    productImage: '',
    caracteristique: '',
    prixEnGros: '',
    prixDetail: '',
    prixAchat: '',
    alerteStock: '',
    uniteConditionnementId: '',
    nombreUnitesParConditionnement: '',
    quantiteInitiale: ''
  });
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  // track if user manually edited these fields during edit mode
  const [prixEnGrosTouched, setPrixEnGrosTouched] = useState(false);
  const [prixDetailTouched, setPrixDetailTouched] = useState(false);

  const canCreate = useHasPermission('PRODUIT_CREER');
  const canModify = useHasPermission('PRODUIT_MODIFIER');
  const canImport = useHasPermission('PRODUIT_CREER');
  const canCreateUnite = useHasPermission('UNITE_CREER');
  const selectedUnite = unites.find((u: any) => u.id.toString() === newProduit.uniteConditionnementId);
  const [search, setSearch] = useState('');
  const [filterUnite, setFilterUnite] = useState('');
  const [imageType, setImageType] = useState<'url' | 'file'>('url');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [showNombreUnites, setShowNombreUnites] = useState(false);
  const [showCaracteristique, setShowCaracteristique] = useState(false);
  const [emballageRows, setEmballageRows] = useState<EmballageRow[]>([]);
  const [originalEmballageIds, setOriginalEmballageIds] = useState<number[]>([]);

  const resetForm = () => {
    setNewProduit({
      nomProduit: '',
      productImage: '',
      caracteristique: '',
      prixEnGros: '',
      prixDetail: '',
      prixAchat: '',
      alerteStock: '',
      uniteConditionnementId: '',
      nombreUnitesParConditionnement: '',
      quantiteInitiale: ''
    });
    // magasin selection moved to Assignation UI
    setSelectedMagasins([]);
    setImageType('url');
    setImageFile(null);
    setShowNombreUnites(false);
    setShowCaracteristique(false);
    setEmballageRows([]);
    setOriginalEmballageIds([]);
    // reset manual-edit flags
    setPrixEnGrosTouched(false);
    setPrixDetailTouched(false);
  };

  // Keep the legacy single uniteConditionnementId/nombreUnitesParConditionnement fields
  // (still used by quantiteInitiale's label/placeholder and by the multipart submit below)
  // mirrored from whichever row in the new emballage list is marked "Par défaut".
  useEffect(() => {
    const def = emballageRows.find(r => r.estParDefaut) || emballageRows[0];
    if (def) {
      setNewProduit(prev => ({ ...prev, uniteConditionnementId: def.uniteId, nombreUnitesParConditionnement: def.nombreUnites }));
      setShowNombreUnites(!!def.uniteId);
    } else {
      setNewProduit(prev => ({ ...prev, uniteConditionnementId: '', nombreUnitesParConditionnement: '' }));
      setShowNombreUnites(false);
    }
  }, [emballageRows]);

  // Validate form in real-time: name, unit and price constraints
  useEffect(() => {
    const errors: string[] = [];
    if (!newProduit.nomProduit.trim()) {
      errors.push('Le nom est obligatoire.');
    }
    const prixAchatVal = newProduit.prixAchat ? parseInt(newProduit.prixAchat, 10) : null;
    const prixEnGrosVal = newProduit.prixEnGros ? parseInt(newProduit.prixEnGros, 10) : null;
    const prixDetailVal = newProduit.prixDetail ? parseInt(newProduit.prixDetail, 10) : null;
    if (prixAchatVal !== null && prixEnGrosVal !== null && prixAchatVal >= prixEnGrosVal) {
      errors.push("Le prix d'achat doit être inférieur au prix en gros.");
    }
    if (prixEnGrosVal !== null && prixDetailVal !== null && prixEnGrosVal >= prixDetailVal) {
      errors.push("Le prix en gros doit être inférieur au prix détail.");
    }
    // conditionnement validation
    if (newProduit.uniteConditionnementId && (!newProduit.nombreUnitesParConditionnement || parseInt(newProduit.nombreUnitesParConditionnement) <= 0)) {
      errors.push("Le nombre d'unités dans cet emballage doit être supérieur à 0.");
    }
    if (!newProduit.quantiteInitiale || parseInt(newProduit.quantiteInitiale) < 0) {
      errors.push('La quantité initiale doit être >= 0.');
    }
    setFormErrors(errors);
    setIsFormValid(errors.length === 0);
  }, [newProduit, selectedMagasins]);

  const fetchProduits = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      if (!token) {
        navigate('/');
        return;
      }
      const res = await fetch(withApi('produits'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        navigate('/');
        return;
      }
      if (!res.ok) throw new Error('Erreur lors du chargement des produits');
      const data = await res.json();
      setProduits(data);
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnites = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      if (!token) {
        navigate('/');
        return;
      }
      const res = await fetch(withApi('unites'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        navigate('/');
        return;
      }
      if (!res.ok) throw new Error('Erreur lors du chargement des unités');
      const data = await res.json();
      setUnites(data);
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    }
  };

  const fetchMagasins = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      if (!token) {
        navigate('/');
        return;
      }
      const res = await fetch(withApi('magasins'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        navigate('/');
        return;
      }
      if (!res.ok) throw new Error('Erreur lors du chargement des magasins');
      const data = await res.json();
      setMagasins(data);
      // default selected magasins to all if none selected and not editing
      if ((!selectedMagasins || selectedMagasins.length === 0) && !editing) {
        setSelectedMagasins(data.map((m: any) => m.id));
      }
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    }
  };

  const fetchMargeConfig = async () => {
    if (!currentBoutique?.id) { setMargeConfig(null); return; }

    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`${API}/configuration-marge/boutique/${currentBoutique.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 404) {
        setMargeConfig(null);
        return;
      }
      if (!res.ok) throw new Error('Erreur lors du chargement de la configuration de marge');
      const data = await res.json();
      setMargeConfig(data);
    } catch (err: any) {
      console.error('fetchMargeConfig', err);
      setMargeConfig(null);
    } finally {
    }
  };

  const handleExportProduits = async () => {
    if (isExporting) return;
    if (!currentBoutique?.id) {
      setMessage('Aucune boutique sélectionnée pour exporter les produits.');
      return;
    }
    try {
      setIsExporting(true);
      const token = localStorage.getItem('smb_token');
      if (!token) {
        navigate('/');
        return;
      }
      const params = new URLSearchParams({ boutiqueId: currentBoutique.id.toString() });
      const res = await fetch(`${API}/produits/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        navigate('/');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Impossible de générer le fichier Excel.');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || res.headers.get('content-disposition') || '';
      let filename = `produits_${currentBoutique.nom || 'boutique'}.xlsx`;
      const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
      if (match) {
        const candidate = match[1] || match[2];
        if (candidate) {
          try {
            filename = decodeURIComponent(candidate);
          } catch (_) {
            filename = candidate;
          }
        }
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setMessage('Export Excel généré avec succès.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message || 'Erreur lors de l\'export des produits.');
    } finally {
      setIsExporting(false);
    }
  };

  // Resolve product image URL robustly: accepts
  // - absolute URLs (http...)
  // - leading slash public paths ('/uploads/products/...')
  // - bare filenames ('abc.jpg') => resolves to `${API_BASE}/uploads/products/abc.jpg`
  const resolveProductImage = (p?: string | null) => {
    const placeholder = 'https://via.placeholder.com/200x200?text=No+Image';
    if (!p) return placeholder;
    const s = String(p);
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (s.startsWith('/uploads') || s.startsWith('uploads')) {
      const clean = s.startsWith('/') ? s : ('/' + s);
      return `${API_BASE}${clean}`;
    }
    // Bare filename -> assume it's in uploads/products
    return `${API_BASE}/uploads/products/${s}`;
  };

  const handleShowDetail = async (produit: any) => {
    try {
      const token = localStorage.getItem('smb_token');
      if (!token) {
        navigate('/');
        return;
      }
      const res = await fetch(`${API}/produits/${produit.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        navigate('/');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setDetailProduit(data);
        setShowDetailModal(true);
        return;
      }
    } catch (err) {
      console.error('Erreur lors du chargement des détails du produit', err);
      setMessage('Impossible de charger le détail du produit.');
    }
    setDetailProduit(produit);
    setShowDetailModal(true);
  };

  useEffect(() => {
    fetchProduits();
    fetchUnites();
    fetchMagasins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // load margin config for the current boutique
    fetchMargeConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBoutique]);

  // user-friendly hint when no margin configuration is present
  const renderMargeHint = () => {
    if (margeConfig === null) {
      return (
        <div className="alert alert-info" role="alert" style={{ marginTop: 8 }}>
          Aucune configuration de marge trouvée pour cette boutique — le calcul automatique des prix est désactivé.
        </div>
      );
    }
    // If configuration exists and is MANUEL, inform the user that provided prices will be used
    const type = (margeConfig.typeMarge || '').toString().toUpperCase();
    if (type === 'MANUEL') {
      return (
        <div className="alert alert-info" role="alert" style={{ marginTop: 8 }}>
          La configuration de marge est en mode <strong>MANUEL</strong> — les prix fournis manuellement dans le formulaire ou le fichier d'import seront utilisés tels quels.
        </div>
      );
    }
    return null;
  };

  useEffect(() => {
    // When a marge config exists, compute prices automatically from CMP (prixAchat).
    // Apply also during editing **unless** the user manually modified the prix fields in this session.
    if (!margeConfig) return;
    const type = (margeConfig.typeMarge || '').toString().toUpperCase();
    // Do not auto-compute prices when configuration is MANUEL
    if (type === 'MANUEL') return;
    const prixAchatVal = Number(newProduit.prixAchat) || 0;
    let prixGros = prixAchatVal;
    let prixDetail = prixAchatVal;

    if ((margeConfig.typeMarge || '').toUpperCase() === 'FIXE') {
      const vG = Number(margeConfig.valeurGros) || 0;
      const vD = Number(margeConfig.valeurDetail) || 0;
      const minG = Number(margeConfig.margeMinimaleGros) || 0;
      const minD = Number(margeConfig.margeMinimaleDetail) || 0;
      const margG = Math.max(vG, minG);
      const margD = Math.max(vD, minD);
      prixGros = Math.round(prixAchatVal + margG);
      prixDetail = Math.round(prixAchatVal + margD);
    } else {
      // POURCENTAGE
      const vgPct = Number(margeConfig.valeurGros) || 0;
      const vdPct = Number(margeConfig.valeurDetail) || 0;
      const compG = Math.round(prixAchatVal * vgPct / 100);
      const compD = Math.round(prixAchatVal * vdPct / 100);
      const minG = Number(margeConfig.margeMinimaleGros) || 0;
      const minD = Number(margeConfig.margeMinimaleDetail) || 0;
      const margG = Math.max(compG, minG);
      const margD = Math.max(compD, minD);
      prixGros = Math.round(prixAchatVal + margG);
      prixDetail = Math.round(prixAchatVal + margD);
    }

    if (!editing) {
      setNewProduit(prev => ({ ...prev, prixEnGros: prixGros.toString(), prixDetail: prixDetail.toString() }));
    } else {
      // If user manually edited prixEnGros/prixDetail during edit session, keep their values
      setNewProduit(prev => ({
        ...prev,
        prixEnGros: prixEnGrosTouched ? prev.prixEnGros : prixGros.toString(),
        prixDetail: prixDetailTouched ? prev.prixDetail : prixDetail.toString()
      }));
    }
  }, [newProduit.prixAchat, margeConfig, editing, prixEnGrosTouched, prixDetailTouched]);

  const handleCreateOrUpdate = async () => {
    // client-side guard (useEffect also handles real-time validation)
    if (!newProduit.nomProduit.trim()) {
      setMessage('Le nom est obligatoire.');
      return;
    }
    // Validation conditionnement
    if (newProduit.uniteConditionnementId && (!newProduit.nombreUnitesParConditionnement || parseInt(newProduit.nombreUnitesParConditionnement) <= 0)) {
      setMessage(`Le nombre d'unités dans cet emballage doit être supérieur à 0.`);
      return;
    }
    if (!newProduit.quantiteInitiale || parseInt(newProduit.quantiteInitiale) < 0) {
      setMessage('La quantité initiale doit être >= 0.');
      return;
    }
    if (emballageRows.some(r => !r.uniteId || !r.nombreUnites || parseInt(r.nombreUnites, 10) <= 0)) {
      setMessage('Veuillez compléter chaque emballage (unité + nombre d\'unités) ou le retirer avec le bouton ×.');
      return;
    }
    {
      const uniteIdsUsed = emballageRows.map(r => r.uniteId);
      if (new Set(uniteIdsUsed).size !== uniteIdsUsed.length) {
        setMessage('Chaque emballage doit utiliser une unité différente.');
        return;
      }
    }
    // price relationships
    const prixAchatVal = newProduit.prixAchat ? parseInt(newProduit.prixAchat, 10) : null;
    const prixEnGrosVal = newProduit.prixEnGros ? parseInt(newProduit.prixEnGros, 10) : null;
    const prixDetailVal = newProduit.prixDetail ? parseInt(newProduit.prixDetail, 10) : null;
    if (prixAchatVal !== null && prixEnGrosVal !== null && prixAchatVal >= prixEnGrosVal) {
      setMessage("Le prix d'achat doit être inférieur au prix en gros.");
      return;
    }
    if (prixEnGrosVal !== null && prixDetailVal !== null && prixEnGrosVal >= prixDetailVal) {
      setMessage("Le prix en gros doit être inférieur au prix détail.");
      return;
    }

    if (editing && !canModify) { setMessage("Vous n'avez pas la permission de modifier ce produit"); return; }
    if (!editing && !canCreate) { setMessage("Vous n'avez pas la permission de créer un produit"); return; }

    setCreating(true);
    setMessage('');
    try {
      const token = localStorage.getItem('smb_token');
      if (!token) {
        navigate('/');
        return;
      }
      const url = editing ? `${API}/produits/${editing.id}` : `${API}/produits`;
      const formData = new FormData();
      formData.append('nomProduit', newProduit.nomProduit);
      // Always send productImage to satisfy backend required param
      if (imageType === 'url') {
        formData.append('productImage', newProduit.productImage || '');
      } else {
        formData.append('productImage', '');
        if (imageFile) {
          formData.append('imageFile', imageFile);
        }
      }
      formData.append('prixEnGros', newProduit.prixEnGros || '');
      formData.append('prixDetail', newProduit.prixDetail || '');
      formData.append('prixAchat', newProduit.prixAchat || '');
      formData.append('alerteStock', newProduit.alerteStock || '');

      if (newProduit.uniteConditionnementId) formData.append('uniteConditionnementId', newProduit.uniteConditionnementId.toString());
      if (newProduit.nombreUnitesParConditionnement) formData.append('nombreUnitesParConditionnement', newProduit.nombreUnitesParConditionnement);
      if (newProduit.quantiteInitiale) formData.append('quantiteInitiale', newProduit.quantiteInitiale);
      if (newProduit.caracteristique) formData.append('caracteristique', newProduit.caracteristique);

      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (res.status === 401) {
        navigate('/');
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur lors de la création`);
      }
      const savedProduit = await res.json();
      const produitId = editing ? editing.id : savedProduit.id;

      try {
        // Process the row marked "par défaut" first: the server clears any previous
        // default as a side effect of setting a new one, so processing it first avoids
        // a transient moment with zero defaults that would otherwise trip the server's
        // own "a product must always have one default" safety net on the other rows.
        const deletedIds = originalEmballageIds.filter(id => !emballageRows.some(r => r.id === id));
        for (const id of deletedIds) {
          await deleteEmballage(produitId, id);
        }
        const ordered = [...emballageRows].sort((a, b) => Number(b.estParDefaut) - Number(a.estParDefaut));
        for (const row of ordered) {
          const payload = { uniteId: Number(row.uniteId), nombreUnites: parseInt(row.nombreUnites, 10), estParDefaut: row.estParDefaut };
          if (row.id != null) {
            await updateEmballage(produitId, row.id, payload);
          } else {
            await createEmballage(produitId, payload);
          }
        }
      } catch (embErr: any) {
        setMessage(embErr.message || "Le produit a été enregistré, mais une erreur est survenue lors de l'enregistrement des emballages.");
        fetchProduits();
        return;
      }

      setShowModal(false);
      resetForm();
      setEditing(null);
      setMessage(editing ? 'Produit modifié avec succès !' : 'Produit créé avec succès !');
      fetchProduits();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message || 'Erreur inconnue');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      title: 'Êtes-vous sûr ?',
      text: 'Cette action est irréversible.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler'
    });
    if (!result.isConfirmed) return;
    try {
      const token = localStorage.getItem('smb_token');
      if (!token) {
        navigate('/');
        return;
      }
      const res = await fetch(`${API}/produits/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        navigate('/');
        return;
      }
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      setMessage('Produit supprimé avec succès !');
      fetchProduits();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message || 'Erreur inconnue');
    }
  };

  // Assignation helpers
  const toggleAssignProduct = (id: number) => {
    if (assignSelectedProductIds.includes(id)) {
      setAssignSelectedProductIds(assignSelectedProductIds.filter(i => i !== id));
      setAssignSelectAll(false);
    } else {
      setAssignSelectedProductIds([...assignSelectedProductIds, id]);
    }
  };

  const toggleAssignAll = () => {
    if (assignSelectAll) {
      setAssignSelectedProductIds([]);
      setAssignSelectAll(false);
    } else {
      const ids = produits.map((p: any) => p.id).filter(Boolean);
      setAssignSelectedProductIds(ids);
      setAssignSelectAll(true);
    }
  };

  const fetchAssignedProducts = async (magasinId: number) => {
    try {
      const token = localStorage.getItem('smb_token'); if (!token) { navigate('/'); return; }
      const res = await fetch(`${API}/magasins/${magasinId}/stocks`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Impossible de récupérer les produits assignés');
      const data = await res.json();
      // map produitIds assigned in this magasin
      const ids = (data || []).map((x: any) => x.produitId).filter(Boolean);
      setAssignExistingProductIds(ids);
    } catch (err: any) {
      setMessage(err.message || 'Erreur lors du chargement');
    }
  };

  const handleAssignSubmit = async () => {
    if (!assignSelectedMagasin) { setMessage('Sélectionnez un magasin'); return; }
    if (assignSelectedProductIds.length === 0) { setMessage('Sélectionnez au moins un produit'); return; }
    try {
      const token = localStorage.getItem('smb_token');
      if (!token) { navigate('/'); return; }
      const res = await fetch(`${API}/magasins/${assignSelectedMagasin}/assign-products`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: assignSelectedProductIds })
      });
      if (res.status === 401) { navigate('/'); return; }
      if (res.status === 403) { setMessage('Accès refusé : permission manquante'); return; }
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Erreur lors de l\'assignation'); }
      const data = await res.json();
      setAssignSuccess(true);
      setMessage(`Assignation réussie (${data.count || data.createdProductIds?.length || 0} produits).`);
      // success message should be green - we use assignSuccess state to control
      setShowAssignModal(false);
      setAssignSelectedProductIds([]);
      setAssignSelectAll(false);
      fetchProduits();
      // refresh assigned IDs for selected magasin
      fetchAssignedProducts(assignSelectedMagasin);
      setTimeout(() => { setMessage(''); setAssignSuccess(false); }, 4000);
    } catch (err: any) {
      setMessage(err.message || 'Erreur inconnue');
    }
  };


  const filtered = produits.filter((p: any) => {
    const target = `${p.nomProduit || ''} ${p.unite?.libelle || ''}`.toLowerCase();
    const matchesSearch = target.includes(search.toLowerCase());
    const matchesUnite = filterUnite === '' || p.unite?.id.toString() === filterUnite;
    return matchesSearch && matchesUnite;
  });

  const isSuccessMessage = assignSuccess || /succès/i.test(message) || /réussi/i.test(message) || /reussi/i.test(message) || /import terminé/i.test(message);

  if (loading) return (
    <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
      <div className="spinner-border text-primary" role="status" style={{ width: 48, height: 48 }}>
        <span className="visually-hidden">Chargement...</span>
      </div>
      <div className="text-muted mt-3">Chargement des produits...</div>
    </div>
  );
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <>
      {message && (
        <div className={`alert ${isSuccessMessage ? 'alert-success' : 'alert-danger'} mb-3`}>
          {message}
        </div>
      )}
      {/* Breadcrumb */}
      <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Produit</div>
        <div className="ps-3">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 p-0">
              <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
              <li className="breadcrumb-item active" aria-current="page">Liste Produit</li>
            </ol>
          </nav>
        </div>
        <div className="ms-auto">
          <div className="btn-group" />
        </div>
      </div>

      <hr />
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="row">
                <div className="col-12 d-flex align-items-center">
                  <div className="me-3">
                    <RequirePermission permission="PRODUIT_CREER">
                      <button
                        className="btn btn-primary mb-3 mb-lg-0"
                        onClick={() => {
                          setEditing(null);
                          resetForm();
                          setShowModal(true);
                        }}
                      >
                        <i className='bx bxs-plus-square'></i> Ajouter un article
                      </button>
                    </RequirePermission>
                  </div>
                  <div className="me-3">
                    <RequirePermission permission="PRODUIT_CREER">
                      <button className="btn btn-outline-primary mb-3 mb-lg-0" onClick={() => setShowImportModal(true)}>
                        <i className='bx bx-import'></i> Import Excel
                      </button>
                    </RequirePermission>
                  </div>
                  <div className="me-3">
                    <RequirePermission permission="PRODUIT_LECTURE">
                      <button
                        className="btn btn-outline-secondary mb-3 mb-lg-0"
                        onClick={handleExportProduits}
                        disabled={isExporting}
                      >
                        {isExporting ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            Export en cours
                          </>
                        ) : (
                          <>
                            <i className='bx bx-export'></i> Export Excel
                          </>
                        )}
                      </button>
                    </RequirePermission>
                  </div>
                  <div className="me-3">
                    <RequirePermission permission="INVENTAIRE_MODIFIER">
                      <button className="btn btn-outline-success mb-3 mb-lg-0" onClick={() => {
                        setAssignSelectedProductIds([]);
                        setAssignSelectAll(false);
                        setAssignSelectedMagasin(magasins && magasins.length > 0 ? magasins[0].id : null);
                        setAssignSearch('');
                        setShowAssignModal(true);
                      }}>
                        <i className='bx bx-transfer'></i> Assignation magasins
                      </button>
                    </RequirePermission>
                  </div>
                  <div className="me-3">
                    <RequirePermission permission="INVENTAIRE_MODIFIER">
                      <button className="btn btn-outline-warning mb-3 mb-lg-0" onClick={() => { navigate('/produits/transfert'); }}>
                        <i className='bx bx-package'></i> Transfert stock
                      </button>
                    </RequirePermission>
                  </div>

                  <div className="me-3">
                    <RequirePermission permission="PRODUIT_LECTURE">
                      <button className="btn btn-outline-info mb-3 mb-lg-0" onClick={() => { setProfitTotals(computeProfitForBoutique(produits)); setShowProfitModal(true); }} title="Voir le bénéfice des articles de la boutique">
                        <i className='bx bx-trending-up'></i> Bénéfice boutique
                      </button>
                    </RequirePermission>
                  </div>
                  <div className="flex-grow-1">
                    <form className="float-lg-end">
                      <div className="row row-cols-lg-auto g-2">
                        <div className="col-12">
                          <div className="position-relative">
                            <input
                              type="text"
                              className="form-control ps-5"
                              placeholder="Rechercher un produit..."
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                            />
                            <span className="position-absolute top-50 product-show translate-middle-y">
                              <i className="bx bx-search"></i>
                            </span>
                          </div>
                        </div>
                        <div className="col-12">
                          <select className="form-control" value={filterUnite} onChange={(e) => setFilterUnite(e.target.value)}>
                            <option value="">Toutes les unités</option>
                            {unites.map((unite: any) => (
                              <option key={unite.id} value={unite.id}>{unite.libelle}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import modal */}
      {showImportModal && (
        <div className="modal show d-block" tabIndex={-1} role="dialog">
          <div className="modal-dialog modal-lg modal-fullscreen-sm-down" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Importer des produits (Excel)</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowImportModal(false)} />
              </div>
              <div className="modal-body">
                <p>Vous pouvez télécharger le modèle de fichier ci-dessous et le remplir avec vos produits.</p>
                <div className="mb-3">
                  <a className="btn btn-sm btn-secondary me-2" href="/produits_template.xlsx" download> Télécharger le modèle (.xlsx)</a>
                  <a className="btn btn-sm btn-outline-secondary" href="/produits_template_example.csv" download> Télécharger un exemple (.csv)</a>
                </div>
                <div className="alert alert-info small" role="note">
                  <p className="mb-1 fw-bold">Colonnes attendues :</p>
                  <ol className="mb-0 ps-3">
                    <li><code>nomProduit</code> (obligatoire) - Nom du produit</li>
                    <li><code>prixAchat</code> - Prix d'achat (nombre entier)</li>
                    <li><code>prixDetail</code> - Prix de détail (nombre entier)</li>
                    <li><code>prixEnGros</code> - Prix en gros (nombre entier)</li>
                    <li><code>alerteStock</code> - Seuil d'alerte stock (nombre entier)</li>
                    <li><code>quantiteInitiale</code> - Quantité initiale (dans l'unité du premier emballage, ou en unités simples si le produit n'a pas d'emballage)</li>
                    <li><code>emballages</code> - (optionnel) Comment ce produit se vend aussi, ex: en carton ET en sac. Format : <code>Libelle:Nombre</code>, plusieurs emballages séparés par un point-virgule. Exemple : <code>Carton:24;Sac:6</code>. Le premier emballage listé devient celui par défaut. Laisser vide si le produit se vend uniquement à l'unité.</li>
                    <li><code>productImage</code> - URL de l'image (optionnel)</li>
                    <li><code>caracteristique</code> - Caractéristiques du produit (optionnel)</li>
                  </ol>
                  <p className="mt-2 mb-0"><strong>Note:</strong> Les noms de colonnes doivent être respectés (l'ordre n'a pas d'importance). Les champs marqués comme optionnels peuvent être laissés vides.</p>
                </div>
                <div className="mb-3">
                  <input type="file" accept=".xlsx,.xls" onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)} />
                </div>
                {canCreateUnite && (
                  <div className="form-check mb-3">
                    <input id="createMissingUnits" className="form-check-input" type="checkbox" checked={createMissingUnits} onChange={e => setCreateMissingUnits(e.target.checked)} />
                    <label htmlFor="createMissingUnits" className="form-check-label small">Créer les unités manquantes (réservé aux utilisateurs autorisés)</label>
                  </div>
                )}
                {renderMargeHint()}
                {isImporting && importProgress > 0 && (() => {
                  const steps = [
                    { key: 'send', icon: 'bx-upload', label: 'Envoi' },
                    { key: 'images', icon: 'bx-image-alt', label: 'Images' },
                    { key: 'save', icon: 'bx-save', label: 'Enregistrement' },
                  ];
                  const stepIndex = importPhase === 'images' ? 1 : (importPhase === 'enregistrement' ? 2 : 0);
                  let subCount: string | null = null;
                  if (importPhase === 'images' && importImagesTotal) {
                    subCount = `${importImagesDone ?? 0} / ${importImagesTotal} images téléchargées`;
                  } else if (importPhase === 'enregistrement' && importTotalRows) {
                    subCount = `${importProcessedCount ?? 0} / ${importTotalRows} produits enregistrés`;
                  }
                  const phaseText = importPhase === 'images'
                    ? 'Téléchargement des images'
                    : importPhase === 'enregistrement'
                      ? 'Enregistrement des produits'
                      : importPhase === 'parsing'
                        ? 'Lecture du fichier'
                        : 'Envoi du fichier';
                  return (
                    <div className="jd-import-progress mb-3">
                      <style>{`
                        .jd-import-progress { border: 1px solid #e3e8ee; border-radius: 14px; padding: 18px 20px 16px; background: linear-gradient(180deg,#f5f9fd 0%, #ffffff 100%); }
                        .jd-import-steps { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
                        .jd-import-step { display:flex; flex-direction:column; align-items:center; gap:6px; flex:1; }
                        .jd-import-step .jd-step-circle {
                          width: 38px; height: 38px; border-radius: 50%; display:flex; align-items:center; justify-content:center;
                          background:#eef1f5; color:#9aa5b1; font-size: 19px; transition: all .35s ease; border: 2px solid #e3e8ee;
                        }
                        .jd-import-step.active .jd-step-circle { background:#2C5F8A; color:#fff; border-color:#2C5F8A; box-shadow: 0 0 0 6px rgba(44,95,138,.15); animation: jd-pulse 1.4s ease-in-out infinite; }
                        .jd-import-step.done .jd-step-circle { background:#2f7a4f; color:#fff; border-color:#2f7a4f; }
                        .jd-import-step .jd-step-label { font-size: 11px; font-weight:700; color:#8b95a1; text-transform:uppercase; letter-spacing:.04em; }
                        .jd-import-step.active .jd-step-label { color:#2C5F8A; }
                        .jd-import-step.done .jd-step-label { color:#2f7a4f; }
                        .jd-import-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
                        .jd-import-head .jd-phase-text { font-weight:700; color:#1c3f5c; display:flex; align-items:center; gap:8px; font-size:14.5px; }
                        .jd-import-head .jd-phase-text i { font-size:18px; animation: jd-bounce 1s ease-in-out infinite; color:#2C5F8A; }
                        .jd-import-head .jd-percent { font-weight:800; font-size:20px; color:#2C5F8A; font-variant-numeric: tabular-nums; }
                        .jd-import-bar-wrap { height: 22px; border-radius: 999px; background:#eef1f5; overflow:hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,.06); }
                        .jd-import-bar-fill {
                          height:100%; border-radius:999px;
                          background: linear-gradient(90deg,#2C5F8A,#4a9fd8 45%,#2C5F8A);
                          background-size: 200% 100%;
                          animation: jd-bar-shine 2.2s linear infinite;
                          transition: width .5s ease;
                        }
                        .jd-import-sub-count { margin-top:8px; text-align:right; color:#6b7684; font-size:12.5px; font-variant-numeric: tabular-nums; }
                        @keyframes jd-pulse { 0%,100% { box-shadow: 0 0 0 6px rgba(44,95,138,.15);} 50% { box-shadow: 0 0 0 10px rgba(44,95,138,.05);} }
                        @keyframes jd-bar-shine { from { background-position: 200% 0; } to { background-position: 0 0; } }
                        @keyframes jd-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
                      `}</style>
                      <div className="jd-import-steps">
                        {steps.map((s, i) => (
                          <div key={s.key} className={`jd-import-step ${i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}`}>
                            <div className="jd-step-circle"><i className={`bx ${i < stepIndex ? 'bx-check' : s.icon}`}></i></div>
                            <div className="jd-step-label">{s.label}</div>
                          </div>
                        ))}
                      </div>
                      <div className="jd-import-head">
                        <div className="jd-phase-text"><i className='bx bx-package'></i> {phaseText}...</div>
                        <div className="jd-percent">{importProgress}%</div>
                      </div>
                      <div className="jd-import-bar-wrap">
                        <div className="jd-import-bar-fill" style={{ width: `${Math.max(4, importProgress)}%` }} />
                      </div>
                      {subCount && <div className="jd-import-sub-count">{subCount}</div>}
                    </div>
                  );
                })()}
                {importErrors.length > 0 && (
                  <div className="alert alert-danger">
                    <ul>
                      {importErrors.map((e, idx) => (<li key={idx}>{e}</li>))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)}>Fermer</button>
                <button type="button" className="btn btn-primary" disabled={!canImport || isImporting} onClick={async () => {
                  if (isImporting) return;
                  if (!canImport) { setImportErrors(['Accès refusé : vous n\'avez pas les droits pour importer des produits.']); return; }
                  if (!importFile) { setMessage('Sélectionnez un fichier à importer'); return; }
                  setImportProgress(0);
                  setImportPhase('upload');
                  setImportImagesDone(null);
                  setImportImagesTotal(null);
                  setImportProcessedCount(null);
                  setImportTotalRows(null);
                  setImportErrors([]);
                  setIsImporting(true);
                  try {
                    const token = localStorage.getItem('smb_token');
                    if (!token) {
                      setImportErrors(['Token manquant. Veuillez vous reconnecter.']);
                      setIsImporting(false);
                      return;
                    }
                    const xhr = new XMLHttpRequest();
                    // use async import endpoint so server can provide parsing progress
                    xhr.open('POST', withApi('produits/import-async'), true);
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                    xhr.upload.onprogress = (e) => {
                      if (e.lengthComputable) {
                        const percentComplete = Math.round((e.loaded / e.total) * 100);
                        setImportProgress(percentComplete);
                      }
                    };
                    xhr.onload = async () => {
                      if (xhr.status === 202) {
                        // job accepted -> poll status
                        const res = JSON.parse(xhr.responseText);
                        const jobId = res.jobId;
                        setImportProgress(2);
                        setImportPhase('parsing');
                        const poll = setInterval(async () => {
                          try {
                            const stRes = await fetch(`${API}/produits/import/${jobId}/status`, { headers: { Authorization: `Bearer ${token}` } });
                            if (stRes.status === 200) {
                              const js = await stRes.json();
                              if (js.progress != null) setImportProgress(js.progress);
                              if (js.phase) setImportPhase(js.phase);
                              if (js.imagesDone != null) setImportImagesDone(js.imagesDone);
                              if (js.imagesTotal != null) setImportImagesTotal(js.imagesTotal);
                              if (js.processedCount != null) setImportProcessedCount(js.processedCount);
                              if (js.totalRows != null) setImportTotalRows(js.totalRows);
                              if (js.state === 'COMPLETED') {
                                clearInterval(poll);
                                setIsImporting(false);
                                setMessage(`Import terminé : ${js.processedCount} produits importés.`);
                                fetchProduits();
                                setShowImportModal(false);
                              } else if (js.state === 'FAILED') {
                                clearInterval(poll);
                                setIsImporting(false);
                                setImportErrors(js.errors || ['Échec de l\'import']);
                              }
                            } else if (stRes.status === 404) {
                              clearInterval(poll);
                              setIsImporting(false);
                              setImportErrors(['Job introuvable']);
                            } else {
                              // keep polling
                            }
                          } catch (err) {
                            clearInterval(poll);
                            setIsImporting(false);
                            setImportErrors([err instanceof Error ? err.message : String(err)]);
                          }
                        }, 600);

                        return;
                      }

                      // synchronous / fallback handling
                      setIsImporting(false);
                      if (xhr.status === 200) {
                        const res = JSON.parse(xhr.responseText);
                        setMessage(`Import réussi : ${res.processedCount} produits importés.`);
                        fetchProduits();
                        setShowImportModal(false);
                      } else if (xhr.status === 401) {
                        setImportErrors(['Authentification nécessaire : token invalide ou expiré. Veuillez vous reconnecter.']);
                      } else if (xhr.status === 403) {
                        setImportErrors(['Accès refusé : vous n\'avez pas les droits pour importer des produits.']);
                      } else {
                        try {
                          const res = JSON.parse(xhr.responseText);
                          if (res.errors) setImportErrors(res.errors);
                          else if (res.details) setImportErrors([res.details]);
                          else setImportErrors([xhr.responseText]);
                        } catch (err) {
                          setImportErrors([xhr.responseText || 'Erreur lors de l\'import']);
                        }
                      }
                    };
                    const fd = new FormData();
                    fd.append('file', importFile);
                    fd.append('createMissingUnits', createMissingUnits ? 'true' : 'false');
                    xhr.send(fd);
                  } catch (err: any) {
                    setImportErrors([err.message || 'Erreur inconnue']);
                    setIsImporting(false);
                  }
                }}>{isImporting ? 'Importation...' : 'Importer'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assignation modal */}
      {showAssignModal && (
        <div className="modal show d-block" tabIndex={-1} role="dialog">
          <div className="modal-dialog modal-xl modal-fullscreen-sm-down" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Assignation produits au magasin</h5>
                <button type="button" className="btn-close" onClick={() => setShowAssignModal(false)} />
              </div>
              <div className="modal-body">
                <div className="mb-3 row g-2">
                  <div className="col-md-6">
                    <select className="form-control" value={assignSelectedMagasin || ''} onChange={(e) => { const val = Number(e.target.value); setAssignSelectedMagasin(val); if (val) fetchAssignedProducts(val); else setAssignExistingProductIds([]); }}>
                      <option value="">Sélectionner un magasin</option>
                      {magasins.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.nom}{m.adresse ? ` (${m.adresse})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <input type="text" className="form-control" placeholder="Rechercher un produit..." value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} />
                  </div>
                </div>
                <div className="mb-2">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" id="assign-select-all" checked={assignSelectAll} onChange={toggleAssignAll} />
                    <label className="form-check-label" htmlFor="assign-select-all">Sélectionner tout (filtré)</label>
                  </div>
                </div>
                <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                  <div className="list-group">
                    {produits.filter((p: any) => p.nomProduit.toLowerCase().includes(assignSearch.toLowerCase())).map((p: any) => {
                      const isAssigned = assignExistingProductIds.includes(p.id);
                      return (
                      <label key={p.id} className="list-group-item d-flex align-items-center">
                        <input type="checkbox" className="form-check-input me-2" checked={isAssigned ? true : assignSelectedProductIds.includes(p.id)} onChange={() => toggleAssignProduct(p.id)} disabled={isAssigned} />
                        <div className="flex-grow-1">
                          <strong>{p.nomProduit}</strong> <small className="text-muted">{p.unite?.libelle ? `(${p.unite.libelle})` : ''}</small>
                        </div>
                        {isAssigned && <span className="badge bg-success ms-3">Affecté</span>}
                      </label>
                    )})}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>Annuler</button>
                <button type="button" className="btn btn-primary" disabled={!assignSelectedMagasin || assignSelectedProductIds.length === 0} onClick={handleAssignSubmit}>Assigner</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showAssignModal && <div className="modal-backdrop fade show"></div>}

      {/* Profit modal (boutique) */}
      {showProfitModal && (() => {
        const beneficeDetail = profitTotals.totalDetail - profitTotals.totalAchat;
        const beneficeGros = profitTotals.totalGros - profitTotals.totalAchat;
        return (
        <div className="modal show d-block" tabIndex={-1} role="dialog" data-testid="profit-modal">
          <div className="modal-dialog modal-md modal-fullscreen-sm-down" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Bénéfice estimé — boutique</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowProfitModal(false)} />
              </div>
              <div className="modal-body">
                <p>Récapitulatif estimé depuis l'inventaire courant (basé sur les quantités et prix enregistrés).</p>

                <div className="row g-3 mb-3">
                  <div className="col-12 col-md-6">
                    <div className="card p-3">
                      <div className="text-muted small">Total achat</div>
                      <div className="h5 fw-bold" data-testid="profit-total-achat">{useFormatMoney()(profitTotals.totalAchat)}</div>
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <div className="card p-3">
                      <div className="text-muted small">Total détail</div>
                      <div className="h5 fw-bold" data-testid="profit-total-detail">{useFormatMoney()(profitTotals.totalDetail)}</div>
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <div className="card p-3 mt-2">
                      <div className="text-muted small">Total gros</div>
                      <div className="h5 fw-bold" data-testid="profit-total-gros">{useFormatMoney()(profitTotals.totalGros)}</div>
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <div className="card p-3 mt-2">
                      <div className="text-muted small">Bénéfice estimé (détail)</div>
                      <div className={`h5 fw-bold ${beneficeDetail < 0 ? 'text-danger' : ''}`} data-testid="profit-estime-detail">{useFormatMoney()(beneficeDetail)}</div>
                      <div className="text-muted small">Bénéfice estimé (gros)</div>
                      <div className={`h6 fw-semibold ${beneficeGros < 0 ? 'text-danger' : ''}`} data-testid="profit-estime-gros">{useFormatMoney()(beneficeGros)}</div>
                    </div>
                  </div>
                </div>

                {(beneficeDetail < 0 || beneficeGros < 0) && (
                  <div className="alert alert-warning small">
                    Attention : le bénéfice estimé est négatif — la valeur du stock au prix d'achat dépasse sa valeur aux prix de vente enregistrés (vérifiez les prix produits ou un écart d'inventaire récent).
                  </div>
                )}
                <div className="alert alert-info small">Note: valeurs estimées à partir des prix stockés — n'inclut pas remises ni coûts additionnels.</div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowProfitModal(false)}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Transfer modal */}

      {/* Affichage des produits en cartes */}
      <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4 row-cols-xxl-5 product-grid">
        {filtered.map((produit: any) => (
          <div key={produit.id} className="col">
            <div className="card product-card position-relative">
              <div className="product-image-wrapper">
                <img
                  src={resolveProductImage(produit.productImage)}
                  className="card-img-top"
                  alt={produit.nomProduit}
                  onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/200x200?text=No+Image'; }}
                />
              </div>

              <div className="icon-group">
                <button className="detail-icon" title="Détails" onClick={() => handleShowDetail(produit)}>
                  <i className="bx bx-show"></i>
                </button>
                <RequirePermission permission="PRODUIT_MODIFIER">
                  <button
                    className="edit-icon"
                    title="Modifier"
                    onClick={() => {
                      setEditing(produit);
                      setNewProduit({
                        nomProduit: produit.nomProduit || '',
                        productImage: produit.productImage || '',
                        caracteristique: produit.caracteristique || '',
                        prixEnGros: produit.prixEnGros?.toString() || '',
                        prixDetail: produit.prixDetail?.toString() || '',
                        prixAchat: produit.prixAchat?.toString() || '',
                        alerteStock: produit.alerteStock?.toString() || '',
                        uniteConditionnementId: produit.unite?.id?.toString() || '',
                        nombreUnitesParConditionnement: produit.nombreUnitesParConditionnement?.toString() || '',
                        quantiteInitiale: produit.quantiteInitialeConditionnements?.toString() || ''
                      });
                      const existingEmballages = (produit.emballages || []).map((e: any) => ({
                        tempId: `existing-${e.id}`,
                        id: e.id,
                        uniteId: e.unite?.id != null ? e.unite.id.toString() : '',
                        nombreUnites: e.nombreUnites != null ? e.nombreUnites.toString() : '',
                        estParDefaut: !!e.estParDefaut
                      }));
                      setEmballageRows(existingEmballages);
                      setOriginalEmballageIds(existingEmballages.map((e: EmballageRow) => e.id).filter((id: number | undefined): id is number => id != null));
                      // set selected magasins for editing using magasinIds provided by backend
                      if (produit.magasinIds && produit.magasinIds.length > 0) {
                        setSelectedMagasins(produit.magasinIds.filter((id: number | null | undefined) => Boolean(id)));
                      } else if (produit.stocks && produit.stocks.length > 0) {
                        setSelectedMagasins(produit.stocks
                          .map((s: any) => s.magasin?.id || s.magasinId)
                          .filter((id: number | null | undefined) => Boolean(id)));
                      } else {
                        setSelectedMagasins(magasins.map((m: any) => m.id));
                      }
                      const isUrl = !!produit.productImage && produit.productImage.includes('://');
                      setImageType(isUrl ? 'url' : 'file');
                      setImageFile(null);
                      setShowNombreUnites(Boolean(produit.unite || produit.nombreUnitesParConditionnement));
                      setShowCaracteristique(Boolean(produit.caracteristique && produit.caracteristique.trim() !== ''));
                      // reset manual-edit flags when starting to edit
                      setPrixEnGrosTouched(false);
                      setPrixDetailTouched(false);
                      setShowModal(true);
                    }}
                  >
                    <i className="bx bxs-edit"></i>
                  </button>
                </RequirePermission>
                <RequirePermission permission="PRODUIT_SUPPRIMER">
                  <button
                    className="delete-icon delete-button"
                    title="Supprimer"
                    onClick={() => handleDelete(produit.id)}
                  >
                    <i className='bx bx-trash-alt'></i>
                  </button>
                </RequirePermission>
              </div>

              <div className="product-details d-flex flex-column">
                <h5 className="card-title" style={{ cursor: 'pointer' }} onClick={() => handleShowDetail(produit)}>{produit.nomProduit}</h5>
                <div className="flex-grow-1" />
                <div className="stars mb-2">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-warning">&#9733;</span>
                  ))}
                </div>
                <p className="fw-bold">Achat : {fmt(produit.prixAchat ?? 0)}</p>
                <p className="fw-bold">En gros : {fmt(produit.prixEnGros ?? 0)}</p>
                <p className="fw-bold">Détail : {fmt(produit.prixDetail ?? 0)}</p>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-12">
            <p>Aucun produit trouvé.</p>
          </div>
        )}
      </div>

      <div className={`modal fade ${showModal ? 'show' : ''}`} style={{ display: showModal ? 'block' : 'none' }} tabIndex={-1}>
        <div className="modal-dialog modal-lg modal-fullscreen-sm-down">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{editing ? 'Modifier le produit' : 'Créer un produit'}</h5>
              <button type="button" className="btn-close" onClick={() => { setShowModal(false); setEditing(null); resetForm(); }} />
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Nom</label>
                  <input type="text" className={`form-control ${!newProduit.nomProduit.trim() && formErrors.includes('Le nom est obligatoire.') ? 'is-invalid' : ''}`} value={newProduit.nomProduit} onChange={(e) => setNewProduit({ ...newProduit, nomProduit: e.target.value })} />
                  <div className="mt-2">
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setShowCaracteristique(prev => !prev)}>
                      {showCaracteristique ? 'Masquer caractéristiques' : 'Ajouter des caractéristiques'}
                    </button>
                  </div>
                </div>
                {showCaracteristique && (
                  <div className="col-md-12">
                    <label className="form-label">Caractéristiques (optionnel)</label>
                    <textarea className="form-control" rows={5} value={newProduit.caracteristique} onChange={(e) => setNewProduit({ ...newProduit, caracteristique: e.target.value })} placeholder="Entrez les caractéristiques, une par ligne ..."></textarea>
                  </div>
                )}

                <div className="col-md-6">
                  <label className="form-label">Image produit</label>
                  <div className="mb-2">
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="imageType"
                        id="imageTypeUrl"
                        value="url"
                        checked={imageType === 'url'}
                        onChange={() => { setImageType('url'); setImageFile(null); }}
                      />
                      <label className="form-check-label" htmlFor="imageTypeUrl">
                        Lien URL
                      </label>
                    </div>
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="imageType"
                        id="imageTypeFile"
                        value="file"
                        checked={imageType === 'file'}
                        onChange={() => { setImageType('file'); setNewProduit(prev => ({ ...prev, productImage: '' })); }}
                      />
                      <label className="form-check-label" htmlFor="imageTypeFile">
                        Uploader un fichier
                      </label>
                    </div>
                  </div>
                  {imageType === 'url' ? (
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Entrez l'URL de l'image"
                      value={newProduit.productImage}
                      onChange={(e) => setNewProduit({ ...newProduit, productImage: e.target.value })}
                    />
                  ) : (
                    <input
                      type="file"
                      className="form-control"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setImageFile(file);
                      }}
                    />
                  )}
                </div>
                    <div className="col-md-6">
                  <label className="form-label">Prix d'achat</label>
                  <input type="number" className={`form-control ${formErrors.some(e => e.includes("prix d'achat")) ? 'is-invalid' : ''}`} value={newProduit.prixAchat} onChange={(e) => setNewProduit({ ...newProduit, prixAchat: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Prix en gros</label>
                  <input
                    type="number"
                    className={`form-control ${formErrors.some(e => e.includes('prix en gros')) ? 'is-invalid' : ''}`}
                    value={newProduit.prixEnGros}
                    onChange={(e) => { setPrixEnGrosTouched(true); setNewProduit({ ...newProduit, prixEnGros: e.target.value }); }}
                    disabled={!editing && !!margeConfig && ((margeConfig.typeMarge || '').toString().toUpperCase() !== 'MANUEL')}
                  />
                  {!editing && margeConfig && ((margeConfig.typeMarge || '').toString().toUpperCase() === 'MANUEL') && <small className="text-muted">Saisir manuellement les prix (configuration MANUEL).</small>}
                  {!editing && margeConfig && ((margeConfig.typeMarge || '').toString().toUpperCase() !== 'MANUEL') && <small className="text-muted">Calculé automatiquement selon la configuration de marge ({margeConfig.typeMarge}).</small>}
                </div>
                <div className="col-md-6">
                  <label className="form-label">Prix détail</label>
                  <input
                    type="number"
                    className={`form-control ${formErrors.some(e => e.includes('prix détail')) ? 'is-invalid' : ''}`}
                    value={newProduit.prixDetail}
                    onChange={(e) => { setPrixDetailTouched(true); setNewProduit({ ...newProduit, prixDetail: e.target.value }); }}
                    disabled={!editing && !!margeConfig && ((margeConfig.typeMarge || '').toString().toUpperCase() !== 'MANUEL')}
                  />
                  {!editing && margeConfig && ((margeConfig.typeMarge || '').toString().toUpperCase() === 'MANUEL') && <small className="text-muted">Saisir manuellement les prix (configuration MANUEL).</small>}
                  {!editing && margeConfig && ((margeConfig.typeMarge || '').toString().toUpperCase() !== 'MANUEL') && <small className="text-muted">Calculé automatiquement selon la configuration de marge ({margeConfig.typeMarge}).</small>}
                </div>
                <div className="col-md-6">
                  <label className="form-label">Alerte stock</label>
                  <input type="number" className="form-control" value={newProduit.alerteStock} onChange={(e) => setNewProduit({ ...newProduit, alerteStock: e.target.value })} />
                </div> 
              

                {/* Emballages : le même produit peut se vendre de plusieurs façons (carton, sac...) */}
                <div className="col-12">
                  <label className="form-label">Ça se vend aussi comment ? <span className="text-muted small">(ex: carton, sac, casier)</span></label>
                  {emballageRows.length === 0 && (
                    <p className="text-muted small mb-2">Non, juste à l'unité.</p>
                  )}
                  {emballageRows.map((row, idx) => (
                    <div className="row g-2 mt-1 align-items-center" key={row.tempId}>
                      <div className="col-6 col-md-5">
                        <select
                          className="form-control"
                          value={row.uniteId}
                          onChange={(e) => {
                            const value = e.target.value;
                            setEmballageRows(rows => rows.map((r, i) => i === idx ? { ...r, uniteId: value } : r));
                          }}
                        >
                          <option value="">Choisir une unité...</option>
                          {unites.map((unite: any) => (
                            <option key={unite.id} value={unite.id}>{unite.libelle}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-6 col-md-4">
                        <input
                          type="number"
                          className="form-control"
                          placeholder="Ex: 12 unités"
                          min={1}
                          value={row.nombreUnites}
                          onChange={(e) => {
                            const value = e.target.value;
                            setEmballageRows(rows => rows.map((r, i) => i === idx ? { ...r, nombreUnites: value } : r));
                          }}
                        />
                      </div>
                      <div className="col-8 col-md-2 form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="emballageDefaut"
                          id={`emballage-defaut-${idx}`}
                          checked={row.estParDefaut}
                          onChange={() => setEmballageRows(rows => rows.map((r, i) => ({ ...r, estParDefaut: i === idx })))}
                        />
                        <label className="form-check-label small" htmlFor={`emballage-defaut-${idx}`}>Par défaut</label>
                      </div>
                      <div className="col-4 col-md-1 text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          title="Retirer cet emballage"
                          onClick={() => setEmballageRows(rows => {
                            const next = rows.filter((_, i) => i !== idx);
                            if (next.length > 0 && !next.some(r => r.estParDefaut)) {
                              next[0] = { ...next[0], estParDefaut: true };
                            }
                            return next;
                          })}
                        >
                          <i className="bx bx-x"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary mt-2"
                    onClick={() => setEmballageRows(rows => [...rows, {
                      tempId: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                      uniteId: '',
                      nombreUnites: '',
                      estParDefaut: rows.length === 0
                    }])}
                  >
                    <i className="bx bx-plus"></i> Ajouter un emballage
                  </button>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Quantité initiale {showNombreUnites ? `(${selectedUnite ? selectedUnite.libelle.toLowerCase() + 's' : 'emballages'})` : '(unités)'}</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder={showNombreUnites ? `Nombre de ${selectedUnite ? selectedUnite.libelle.toLowerCase() + 's' : 'emballages'}` : 'Quantité en unités de base'}
                    value={newProduit.quantiteInitiale}
                    onChange={(e) => setNewProduit({ ...newProduit, quantiteInitiale: e.target.value })}
                    min={0}
                  />
                </div>

                {/* Magasin assignment moved to the Assignation module */}

              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setEditing(null); resetForm(); }}>Annuler</button>
              <div className="me-auto">
                {formErrors.length > 0 && (
                  <div className="alert alert-danger p-2 m-0" style={{ minWidth: 'min(300px, 90vw)' }}>
                    <ul className="mb-0">
                      {formErrors.map((err, idx) => <li key={idx}>{err}</li>)}
                    </ul>
                  </div>
                )}
              </div>
              <button type="button" className="btn btn-primary" onClick={handleCreateOrUpdate} disabled={!isFormValid || creating} title={formErrors.length > 0 ? formErrors.join('; ') : ''}>
                {creating ? (editing ? 'Modification...' : 'Création...') : (editing ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      </div>
      {showModal && <div className="modal-backdrop fade show"></div>}

      {/* Detail Modal */}
      {showDetailModal && detailProduit && (
        <div className={`modal fade ${showDetailModal ? 'show' : ''}`} style={{ display: showDetailModal ? 'block' : 'none' }} tabIndex={-1}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Détails du produit</h5>
                <button type="button" className="btn-close" onClick={() => { setShowDetailModal(false); setDetailProduit(null); }} />
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <img
                      src={resolveProductImage(detailProduit.productImage)}
                      className="img-fluid"
                      alt={detailProduit.nomProduit}
                    />
                  </div>
                  <div className="col-md-6">
                    <h4>{detailProduit.nomProduit}</h4>
                    <p><strong>Prix d'achat :</strong> {fmt(detailProduit.prixAchat ?? 0)}</p>
                    <p><strong>Prix en gros :</strong> {fmt(detailProduit.prixEnGros ?? 0)}</p>
                    <p><strong>Prix détail :</strong> {fmt(detailProduit.prixDetail ?? 0)}</p>
                    <p><strong>Alerte stock :</strong> {detailProduit.alerteStock ?? 0}</p>
                    {detailProduit.emballages && detailProduit.emballages.length > 1 ? (
                      <p><strong>Vendu aussi en :</strong> {detailProduit.emballages.map((e: any) => `${e.uniteLibelle || e.unite?.libelle} (${e.nombreUnites} unités)${e.estParDefaut ? ' — par défaut' : ''}`).join(', ')}</p>
                    ) : (
                      <p><strong>Vendu aussi en :</strong> {detailProduit.unite?.libelle ? `${detailProduit.unite.libelle} (${detailProduit.nombreUnitesParConditionnement ?? 1} unités)` : 'Juste à l\'unité'}</p>
                    )}
                    <p><strong>Quantité initiale :</strong> {detailProduit.quantiteInitialeConditionnements !== undefined && detailProduit.quantiteInitialeConditionnements !== null ? detailProduit.quantiteInitialeConditionnements : 'N/A'} {detailProduit.unite?.libelle ? detailProduit.unite.libelle.toLowerCase() + 's' : 'unités'}</p>
                    {detailProduit.caracteristique && (
                      <div style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>
                        <h6>Caractéristiques</h6>
                        <div>{detailProduit.caracteristique}</div>
                      </div>
                    )}
                  </div>
                </div>
                {detailProduit.magasinStocks && detailProduit.magasinStocks.length > 0 && (
                  <div className="row mt-4">
                    <div className="col-12">
                      <h6>Répartition du stock par magasin</h6>
                      <ul className="list-group">
                        {detailProduit.magasinStocks.map((m: any) => (
                          <li key={m.id} className="list-group-item d-flex justify-content-between align-items-center">
                            <span>
                              {m.nom || 'Magasin'}
                              {m.adresse ? ` (${m.adresse})` : ''}
                            </span>
                            <span className="badge bg-primary rounded-pill">{m.quantiteDisponible ?? 0}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowDetailModal(false); setDetailProduit(null); }}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showDetailModal && <div className="modal-backdrop fade show"></div>}

    </>
  );
};

export default Produits;
