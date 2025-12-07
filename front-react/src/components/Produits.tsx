import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import '../assets/css/style_produit.css';

const Produits: React.FC = () => {
  const [produits, setProduits] = useState<any[]>([]);
  const [unites, setUnites] = useState<any[]>([]);
  const [magasins, setMagasins] = useState<any[]>([]);
  const [selectedMagasins, setSelectedMagasins] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
    prixEnGros: '',
    prixDetail: '',
    prixAchat: '',
    alerteStock: '',
    uniteId: ''
  });
  const [imageType, setImageType] = useState<'url' | 'file'>('url');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const resetForm = () => {
    setNewProduit({
      nomProduit: '',
      productImage: '',
      prixEnGros: '',
      prixDetail: '',
      prixAchat: '',
      alerteStock: '',
      uniteId: ''
    });
    setSelectedMagasins([]);
    setImageType('url');
    setImageFile(null);
  };

  const fetchProduits = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch('http://localhost:8085/api/produits', {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      const res = await fetch('http://localhost:8085/api/unites', {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      const res = await fetch('http://localhost:8085/api/magasins', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors du chargement des magasins');
      const data = await res.json();
      setMagasins(data);
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    }
  };

  useEffect(() => {
    fetchProduits();
    fetchUnites();
    fetchMagasins();
  }, []);

  const handleCreateOrUpdate = async () => {
    if (!newProduit.nomProduit.trim()) {
      setMessage('Le nom est obligatoire.');
      return;
    }
    if (!newProduit.uniteId) {
      setMessage('Sélectionnez une unité.');
      return;
    }

    setCreating(true);
    setMessage('');
    try {
      const token = localStorage.getItem('smb_token');
      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `http://localhost:8085/api/produits/${editing.id}` : 'http://localhost:8085/api/produits';

      const formData = new FormData();
      formData.append('nomProduit', newProduit.nomProduit);
      formData.append('productImage', newProduit.productImage);
      if (imageFile) {
        formData.append('imageFile', imageFile);
      }
      formData.append('prixEnGros', newProduit.prixEnGros);
      formData.append('prixDetail', newProduit.prixDetail);
      formData.append('prixAchat', newProduit.prixAchat);
      formData.append('alerteStock', newProduit.alerteStock);
      formData.append('uniteId', newProduit.uniteId);
      selectedMagasins.forEach(id => formData.append('magasinIds', id.toString()));

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Erreur lors de la ${editing ? 'modification' : 'création'}`);
      }
      setShowModal(false);
      resetForm();
      setEditing(null);
      setMessage(`Produit ${editing ? 'modifié' : 'créé'} avec succès !`);
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
      const res = await fetch(`http://localhost:8085/api/produits/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      setMessage('Produit supprimé avec succès !');
      fetchProduits();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message || 'Erreur inconnue');
    }
  };

  const filtered = produits.filter((p: any) => {
    const target = `${p.nomProduit || ''} ${p.unite?.libelle || ''}`.toLowerCase();
    return target.includes(search.toLowerCase());
  });

  if (loading) return <div>Chargement...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <>
      {message && (
        <div className={`alert ${message.includes('succès') ? 'alert-success' : 'alert-danger'} mb-3`}>
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
          <div className="btn-group">
           
          </div>
        </div>
      </div>
      {/* End breadcrumb */}
      <hr />
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="row">
                <div className="col-12 d-flex align-items-center">
                  <div className="me-3">
                    <button className="btn btn-primary mb-3 mb-lg-0" onClick={() => { setEditing(null); resetForm(); setShowModal(true); }}>
                      <i className='bx bxs-plus-square'></i> Ajouter un article
                    </button>
                  </div>
                  <div className="me-3">
                    <button className="btn btn-outline-primary mb-3 mb-lg-0" onClick={() => setShowImportModal(true)}>
                      <i className='bx bx-import'></i> Import Excel
                    </button>
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
                          <button type="button" className="btn btn-primary">Rechercher</button>
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
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowImportModal(false)}></button>
              </div>
                <div className="modal-body">
                <p>Vous pouvez télécharger le modèle de fichier ci-dessous et le remplir avec vos produits.</p>
                  <div className="mb-3">
                    <a className="btn btn-sm btn-secondary" href="/produits_template.xlsx" download> Télécharger le modèle </a>
                  </div>
                <div className="mb-3">
                  <input type="file" accept=".xlsx,.xls" onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)} />
                </div>
                {isImporting && (
                  <div className="mb-3">Traitement en cours, veuillez patienter...</div>
                )}
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
                <button type="button" className="btn btn-primary" onClick={async () => {
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

      {/* Affichage des produits en cartes */}
      <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4 row-cols-xxl-5 product-grid">
        {filtered.map((produit: any) => (
          <div key={produit.id} className="col">
            <div className="card product-card position-relative">
              <img
                src={produit.productImage ? (produit.productImage.startsWith('http') ? produit.productImage : `http://localhost:8085/uploads/products/${produit.productImage}`) : 'https://via.placeholder.com/200x200?text=No+Image'}
                className="card-img-top"
                alt={produit.nomProduit}
                onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/200x200?text=No+Image'; }}
              />

              <div className="icon-group">
                <button className="detail-icon" title="Détails" onClick={() => { setDetailProduit(produit); setShowDetailModal(true); }}>
                  <i className="bx bx-show"></i>
                </button>
                <button
                  className="edit-icon"
                  title="Modifier"
                  onClick={() => {
                    setEditing(produit);
                    setNewProduit({
                      nomProduit: produit.nomProduit || '',
                      productImage: produit.productImage || '',
                      prixEnGros: produit.prixEnGros?.toString() || '',
                      prixDetail: produit.prixDetail?.toString() || '',
                      prixAchat: produit.prixAchat?.toString() || '',
                      alerteStock: produit.alerteStock?.toString() || '',
                      uniteId: produit.unite?.id ? produit.unite.id.toString() : ''
                    });
                    setImageType(produit.productImage && produit.productImage.startsWith('http') ? 'url' : 'file');
                    setImageFile(null); // Reset file input
                    setShowModal(true);
                  }}
                >
                  <i className="bx bxs-edit"></i>
                </button>
                <button
                  className="delete-icon delete-button"
                  title="Supprimer"
                  onClick={() => handleDelete(produit.id)}
                >
                  <i className='bx bx-trash-alt'></i>
                </button>
              </div>

              <div className="card-body product-details text-center">
                <h6 className="card-title cursor-pointer fw-bold">{produit.nomProduit}</h6>
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
            <div className="modal-header">
              <h5 className="modal-title">{editing ? 'Modifier le produit' : 'Créer un produit'}</h5>
              <button type="button" className="btn-close" onClick={() => { setShowModal(false); setEditing(null); resetForm(); }}></button>
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Nom</label>
                  <input type="text" className="form-control" value={newProduit.nomProduit} onChange={(e) => setNewProduit({ ...newProduit, nomProduit: e.target.value })} />
                </div>
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
                        onChange={(e) => setImageType(e.target.value as 'url')}
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
                        onChange={(e) => setImageType(e.target.value as 'file')}
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
                <div className="col-md-4">
                  <label className="form-label">Prix en gros</label>
                  <input type="number" className="form-control" value={newProduit.prixEnGros} onChange={(e) => setNewProduit({ ...newProduit, prixEnGros: e.target.value })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Prix détail</label>
                  <input type="number" className="form-control" value={newProduit.prixDetail} onChange={(e) => setNewProduit({ ...newProduit, prixDetail: e.target.value })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Prix d'achat</label>
                  <input type="number" className="form-control" value={newProduit.prixAchat} onChange={(e) => setNewProduit({ ...newProduit, prixAchat: e.target.value })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Alerte stock</label>
                  <input type="number" className="form-control" value={newProduit.alerteStock} onChange={(e) => setNewProduit({ ...newProduit, alerteStock: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Unité</label>
                  <select className="form-control" value={newProduit.uniteId} onChange={(e) => setNewProduit({ ...newProduit, uniteId: e.target.value })}>
                    <option value="">Sélectionner une unité</option>
                    {unites.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.libelle}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label">Magasins (sélectionnez ceux où initialiser le stock à 0)</label>
                  <div className="row">
                    {magasins.map((m: any) => (
                      <div key={m.id} className="col-md-4">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`magasin-${m.id}`}
                            checked={selectedMagasins.includes(m.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMagasins([...selectedMagasins, m.id]);
                              } else {
                                setSelectedMagasins(selectedMagasins.filter(id => id !== m.id));
                              }
                            }}
                          />
                          <label className="form-check-label" htmlFor={`magasin-${m.id}`}>
                            {m.nom} ({m.adresse})
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setEditing(null); resetForm(); }}>Annuler</button>
              <button type="button" className="btn btn-primary" onClick={handleCreateOrUpdate} disabled={creating}>
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
                <button type="button" className="btn-close" onClick={() => { setShowDetailModal(false); setDetailProduit(null); }}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <img
                      src={detailProduit.productImage ? (detailProduit.productImage.startsWith('http') ? detailProduit.productImage : `http://localhost:8085/uploads/products/${detailProduit.productImage}`) : 'https://via.placeholder.com/200x200?text=No+Image'}
                      className="img-fluid"
                      alt={detailProduit.nomProduit}
                    />
                  </div>
                  <div className="col-md-6">
                    <h4>{detailProduit.nomProduit}</h4>
                    <p><strong>Prix en gros:</strong> {detailProduit.prixEnGros || 0} F CFA</p>
                    <p><strong>Prix détail:</strong> {detailProduit.prixDetail || 0} F CFA</p>
                    <p><strong>Alerte stock:</strong> {detailProduit.alerteStock || 0}</p>
                    <p><strong>Unité:</strong> {detailProduit.unite?.libelle || 'N/A'}</p>
                  </div>
                </div>
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
