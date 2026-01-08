import React, { useEffect, useState } from 'react';
import useHasPermission from '../contexts/useHasPermission';
import { formatServerDate } from '../utils/date';
import Swal from 'sweetalert2';

const API_BASE = 'http://localhost:8085';
const AUTH_HEADER = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

const Documents: React.FC = () => {
  const canView = useHasPermission('DOCUMENTS_VOIR');
  const canDownload = useHasPermission('DOCUMENTS_TELECHARGER');

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [refFilter, setRefFilter] = useState('');

  const fetchList = async (p = page) => {
    if (!canView) return;
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', String(p));
      params.append('size', String(size));
      if (typeFilter) params.append('type', typeFilter);
      if (refFilter) params.append('ref', refFilter);
      const res = await fetch(`${API_BASE}/api/documents?${params.toString()}`, { headers: AUTH_HEADER() });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems(data.content || []);
      setTotal(data.totalElements || 0);
      setPage(data.number || 0);
    } catch (e: any) {
      console.error('fetchList', e);
      setError(String(e.message || e));
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchList(0); }, [canView, typeFilter, refFilter]);

  const openPdf = async (url: string) => {
    try {
      const full = url.startsWith('http') ? url : `${API_BASE}${url}`;
      const res = await fetch(full, { headers: AUTH_HEADER() });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const blob = await res.blob();
      const bUrl = URL.createObjectURL(blob);
      window.open(bUrl, '_blank');
    } catch (e: any) {
      Swal.fire('Erreur', e && e.message ? e.message : 'Erreur ouverture PDF', 'error');
    }
  };

  const downloadFile = async (url: string, filename?: string) => {
    try {
      const full = url.startsWith('http') ? url : `${API_BASE}${url}`;
      const res = await fetch(full, { headers: AUTH_HEADER() });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e: any) {
      Swal.fire('Erreur', e && e.message ? e.message : 'Erreur téléchargement', 'error');
    }
  };

  const downloadCsv = async (type: string, id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/documents/${type}/${id}/download?format=csv`, { headers: AUTH_HEADER() });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `document-${type}-${id}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e: any) {
      Swal.fire('Erreur', e && e.message ? e.message : 'Erreur génération CSV', 'error');
    }
  };

  const nextPage = () => { if ((page + 1) * size < total) fetchList(page + 1); };
  const prevPage = () => { if (page > 0) fetchList(page - 1); };

  if (!canView) return <div className="alert alert-warning">Accès non autorisé</div>;

  return (
    <div>
      <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Documents</div>
        <div className="ps-3">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 p-0">
              <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
              <li className="breadcrumb-item active" aria-current="page">Liste des documents</li>
            </ol>
          </nav>
        </div>
        <div className="ms-auto">
          <div className="btn-group" />
        </div>
      </div>

      <hr />

      <div className="row mb-3">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="row">
                <div className="col-12 d-flex align-items-center">
                  <div className="flex-grow-1">
                    <form className="float-lg-end">
                      <div className="row row-cols-lg-auto g-2 align-items-center">
                        <div className="col-12">
                          <input type="text" className="form-control" placeholder="Référence" value={refFilter} onChange={(e) => setRefFilter(e.target.value)} />
                        </div>
                        <div className="col-12">
                          <select className="form-control" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                            <option value="">Type (tous)</option>
                            <option value="VENTE">Vente</option>
                            <option value="RECEPTION">Reception</option>
                            <option value="INVENTAIRE">Inventaire</option>
                            <option value="CAISSE">Caisse</option>
                          </select>
                        </div>
                        <div className="col-12">
                          <button className="btn btn-outline-success" onClick={(e) => { e.preventDefault(); fetchList(0); }}>Filtrer</button>
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

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? <div className="text-muted">Chargement...</div> : (
        <div className="card">
          <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center"><h5 className="mb-0">Documents</h5></div>
          <div className="card-body p-2">
            <div className="table-responsive">
              <table className="table table-sm table-striped">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Référence</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it: any) => (
                    <tr key={`${it.sourceType}-${it.sourceId}`}>
                      <td>{it.sourceType}</td>
                      <td>{it.reference || (it.sourceType + '-' + it.sourceId)}</td>
                      <td>{formatServerDate(it.date)}</td>
                      <td>
                        <div className="d-flex gap-2 align-items-center">
                          <button className="btn btn-sm btn-outline-primary" title="Voir" onClick={() => openPdf(it.previewUrl)}>Voir</button>
                          {canDownload ? (
                            <>
                              <button className="btn btn-sm btn-primary" title="Télécharger PDF" onClick={() => downloadFile(it.downloadUrl, `${it.sourceType}-${it.sourceId}.pdf`)}>PDF</button>
                              <button className="btn btn-sm btn-outline-secondary" title="Télécharger CSV" onClick={() => downloadCsv(it.sourceType.toLowerCase(), it.sourceId)}>CSV</button>
                            </>
                          ) : (
                            <span className="text-muted small">Téléchargement non autorisé</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-between align-items-center mt-2">
              <div className="text-muted">Total: {total}</div>
              <div>
                <button className="btn btn-sm btn-outline-primary me-2" onClick={prevPage} disabled={page === 0}>Préc</button>
                <span className="mx-2">Page {page + 1} / {Math.max(1, Math.ceil(total / size))}</span>
                <button className="btn btn-sm btn-outline-primary ms-2" onClick={nextPage} disabled={(page + 1) * size >= total}>Suiv</button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Documents;
