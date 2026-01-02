import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useUser } from '../contexts/UserContext';
import useHasPermission from '../contexts/useHasPermission';
import RequirePermission from './RequirePermission';
import '../assets/css/style_produit.css';

const Produits: React.FC = () => {
  const navigate = useNavigate();
  const { currentBoutique } = useUser();
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


  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);
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
  const selectedUnite = unites.find((u: any) => u.id.toString() === newProduit.uniteConditionnementId);
  const [search, setSearch] = useState('');
  const [filterUnite, setFilterUnite] = useState('');
  const [imageType, setImageType] = useState<'url' | 'file'>('url');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [showNombreUnites, setShowNombreUnites] = useState(false);
  const [showCaracteristique, setShowCaracteristique] = useState(false);

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
    // reset manual-edit flags
    setPrixEnGrosTouched(false);
    setPrixDetailTouched(false);
  };

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
      errors.push("Le nombre d'unités par conditionnement doit être supérieur à 0.");
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
      const res = await fetch('http://localhost:8085/api/produits', {
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
      const res = await fetch('http://localhost:8085/api/unites', {
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
      const res = await fetch('http://localhost:8085/api/magasins', {
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
    } finally {
      setLoading(false);
    }
  };

  const fetchMargeConfig = async () => {
    if (!currentBoutique?.id) { setMargeConfig(null); return; }

    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/configuration-marge/boutique/${currentBoutique.id}`, {
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

  const handleShowDetail = async (produit: any) => {
    try {
      const token = localStorage.getItem('smb_token');
      if (!token) {
        navigate('/');
        return;
      }
      const res = await fetch(`http://localhost:8085/api/produits/${produit.id}`, {
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

  useEffect(() => {
    // When a marge config exists, compute prices automatically from CMP (prixAchat).
    // Apply also during editing **unless** the user manually modified the prix fields in this session.
    if (!margeConfig) return;
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
      setMessage(`Le nombre d'unités par conditionnement doit être supérieur à 0.`);
      return;
    }
    if (!newProduit.quantiteInitiale || parseInt(newProduit.quantiteInitiale) < 0) {
      setMessage('La quantité initiale doit être >= 0.');
      return;
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
      const url = editing ? `http://localhost:8085/api/produits/${editing.id}` : 'http://localhost:8085/api/produits';
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
      const res = await fetch(`http://localhost:8085/api/produits/${id}`, {
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
      const res = await fetch(`http://localhost:8085/api/magasins/${magasinId}/stocks`, { headers: { Authorization: `Bearer ${token}` } });
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
      const res = await fetch(`http://localhost:8085/api/magasins/${assignSelectedMagasin}/assign-products`, {
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

  if (loading) return <div>Chargement...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <>
      {message && (
        <div className={`alert ${assignSuccess ? 'alert-success' : (message.includes('succès') ? 'alert-success' : 'alert-danger')} mb-3`}>
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
          <div className="modal-dialog modal-lg" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Importer des produits (Excel)</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowImportModal(false)} />
              </div>
              <div className="modal-body">
                <p>Vous pouvez télécharger le modèle de fichier ci-dessous et le remplir avec vos produits.</p>
                <div className="mb-3">
                  <a className="btn btn-sm btn-secondary" href="/produits_template.xlsx" download> Télécharger le modèle </a>
                </div>
                {/* <div className="alert alert-info small" role="note">
                  <p className="mb-1 fw-bold">Colonnes attendues (respecter l'entête) :</p>
                  <ul className="mb-0 ps-3">
                    <li><code>nomProduit</code> (obligatoire)</li>
                    <li><code>productImage</code> (URL ou nom de fichier existant)</li>
                    <li><code>prixAchat</code>, <code>prixEnGros</code>, <code>prixDetail</code></li>
                    <li><code>alerteStock</code>, <code>id_unite</code> (identifiant de l'unité), <code>nombreUnitesParConditionnement</code></li>
                    <li><code>quantiteInitiale</code> (conditionnements) et <code>magasinIds</code> séparés par des virgules</li>
                  </ul>
                </div> */}
                <div className="mb-3">
                  <input type="file" accept=".xlsx,.xls" onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)} />
                </div>
                {isImporting && <div className="mb-3">Traitement en cours, veuillez patienter...</div>}
                {importProgress > 0 && (
                  <div className="mb-3">
                    <div className="progress">
                      <div className="progress-bar" role="progressbar" style={{ width: `${importProgress}%` }}>{importProgress}%</div>
                    </div>
                  </div>
                )}
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
                <button type="button" className="btn btn-primary" disabled={!canImport} onClick={async () => {
                  if (!canImport) { setImportErrors(['Accès refusé : vous n\'avez pas les droits pour importer des produits.']); return; }
                  if (!importFile) { setMessage('Sélectionnez un fichier à importer'); return; }
                  setImportProgress(0);
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
                    xhr.open('POST', 'http://localhost:8085/api/produits/import', true);
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                    xhr.upload.onprogress = (e) => {
                      if (e.lengthComputable) {
                        const percentComplete = Math.round((e.loaded / e.total) * 100);
                        setImportProgress(percentComplete);
                      }
                    };
                    xhr.onload = async () => {
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
                    xhr.send(fd);
                  } catch (err: any) {
                    setImportErrors([err.message || 'Erreur inconnue']);
                    setIsImporting(false);
                  }
                }}>Importer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assignation modal */}
      {showAssignModal && (
        <div className="modal show d-block" tabIndex={-1} role="dialog">
          <div className="modal-dialog modal-xl" role="document">
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

      {/* Transfer modal */}

      {/* Affichage des produits en cartes */}
      <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4 row-cols-xxl-5 product-grid">
        {filtered.map((produit: any) => (
          <div key={produit.id} className="col">
            <div className="card product-card position-relative">
              <div className="product-image-wrapper">
                <img
                  src={produit.productImage || 'https://via.placeholder.com/200x200?text=No+Image'}
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
                <p className="fw-bold">Achat : {produit.prixAchat || 0} F CFA</p>
                <p className="fw-bold">En gros : {produit.prixEnGros || 0} F CFA</p>
                <p className="fw-bold">Détail : {produit.prixDetail || 0} F CFA</p>
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
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header bg-black">
              <h5 className="modal-title text-white">{editing ? 'Modifier le produit' : 'Créer un produit'}</h5>
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
                    disabled={!editing && !!margeConfig}
                  />
                  {!editing && margeConfig && <small className="text-muted">Calculé automatiquement selon la configuration de marge ({margeConfig.typeMarge}).</small>}
                </div>
                <div className="col-md-6">
                  <label className="form-label">Prix détail</label>
                  <input
                    type="number"
                    className={`form-control ${formErrors.some(e => e.includes('prix détail')) ? 'is-invalid' : ''}`}
                    value={newProduit.prixDetail}
                    onChange={(e) => { setPrixDetailTouched(true); setNewProduit({ ...newProduit, prixDetail: e.target.value }); }}
                    disabled={!editing && !!margeConfig}
                  />
                  {!editing && margeConfig && <small className="text-muted">Calculé automatiquement selon la configuration de marge ({margeConfig.typeMarge}).</small>}
                </div>
                <div className="col-md-6">
                  <label className="form-label">Alerte stock</label>
                  <input type="number" className="form-control" value={newProduit.alerteStock} onChange={(e) => setNewProduit({ ...newProduit, alerteStock: e.target.value })} />
                </div> 
              

                {/* Unité de conditionnement + nombre + quantité initiale */}
                <div className="col-12">
                  <label className="form-label">Unité de conditionnement</label>
                  <div className="row g-2 mt-1">
                    <div className="col-md-6">
                      <select className="form-control" value={newProduit.uniteConditionnementId} onChange={(e) => {
                        const value = e.target.value;
                        setNewProduit({ ...newProduit, uniteConditionnementId: value });
                        setShowNombreUnites(value !== '');
                      }}>
                        <option value="">Aucune (unité de base)</option>
                        {unites.map((unite: any) => (
                          <option key={unite.id} value={unite.id}>{unite.libelle}</option>
                        ))}
                      </select>
                    </div>

                    {showNombreUnites && (
                      <div className="col-md-6">
                        <input
                          type="number"
                          className="form-control"
                          placeholder={`Ex: 12 (1 ${selectedUnite ? selectedUnite.libelle.toLowerCase() : 'conditionnement'} = 12 unités)`}
                          value={newProduit.nombreUnitesParConditionnement}
                          onChange={(e) => setNewProduit({ ...newProduit, nombreUnitesParConditionnement: e.target.value })}
                          min={1}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Quantité initiale {showNombreUnites ? `(${selectedUnite ? selectedUnite.libelle.toLowerCase() + 's' : 'conditionnements'})` : '(unités)'}</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder={showNombreUnites ? `Nombre de ${selectedUnite ? selectedUnite.libelle.toLowerCase() + 's' : 'conditionnements'}` : 'Quantité en unités de base'}
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
                  <div className="alert alert-danger p-2 m-0" style={{ minWidth: '300px' }}>
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
                      src={detailProduit.productImage || 'https://via.placeholder.com/200x200?text=No+Image'}
                      className="img-fluid"
                      alt={detailProduit.nomProduit}
                    />
                  </div>
                  <div className="col-md-6">
                    <h4>{detailProduit.nomProduit}</h4>
                    <p><strong>Prix d'achat :</strong> {detailProduit.prixAchat ?? 0} F CFA</p>
                    <p><strong>Prix en gros :</strong> {detailProduit.prixEnGros ?? 0} F CFA</p>
                    <p><strong>Prix détail :</strong> {detailProduit.prixDetail ?? 0} F CFA</p>
                    <p><strong>Alerte stock :</strong> {detailProduit.alerteStock ?? 0}</p>
                    <p><strong>Unité de conditionnement :</strong> {detailProduit.unite?.libelle ? `${detailProduit.unite.libelle} (${detailProduit.nombreUnitesParConditionnement ?? 1} unités)` : 'Unité de base'}</p>
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
