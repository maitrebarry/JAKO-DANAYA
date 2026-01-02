import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import { useUser } from '../contexts/UserContext';
import useHasPermission from '../contexts/useHasPermission';
import { formatServerDate } from '../utils/date';

interface HistoriqueItem {
  type: 'LIVRAISON' | 'PAIEMENT';
  id: number;
  date: string | null;
  dateIso?: string | null;
  reference: string | null;
  referenceCommandeId?: number | null;
  referenceCommande: string | null;
  client: string | null;
  fournisseur?: string | null;
  montant?: number | null;
  annule?: boolean | null;
  annuleAt?: string | null;
  annuleReason?: string | null;
  annulePar?: number | null;
  annuleParNom?: string | null;
  referenceCaisse?: string | null;
}

const VentesHistorique: React.FC = () => {
  const { currentBoutique, logout } = useUser();
  const [viewingAnnulations, setViewingAnnulations] = useState(false);
  const [items, setItems] = useState<HistoriqueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'LIVRAISON' | 'PAIEMENT'>('ALL');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // If a query param type=PAIEMENT is present, pre-select the paiement filter (for quick access from vente page)
    try {
      const qp = new URLSearchParams(location.search);
      const t = qp.get('type');
      if (t && t.toUpperCase() === 'PAIEMENT') setFilterType('PAIEMENT');
    } catch (e) {}
    if (currentBoutique) fetchHistorique(viewingAnnulations);
  }, [currentBoutique, viewingAnnulations, location.search]);

  const fetchHistorique = async (annulations = false) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('smb_token');
      const endpoint = annulations ? `/api/historique/ventes/annulations/boutique/${currentBoutique?.id}` : `/api/historique/ventes/boutique/${currentBoutique?.id}`;
      console.debug('fetchHistorique: token present?', !!token, 'endpoint=', endpoint);
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`http://localhost:8085${endpoint}`, { headers });
      if (res.status === 401) {
        const txt = await res.text().catch(() => null);
        console.debug('fetchHistorique: 401 body=', txt);
        const result = await Swal.fire({
          icon: 'warning',
          title: 'Session expirée ?',
          html: `<div>Le serveur a répondu 401 (non autorisé). Détails: <pre style="white-space:pre-wrap">${txt || ''}</pre></div>`,
          showCancelButton: true,
          confirmButtonText: 'Se reconnecter',
          cancelButtonText: 'Rester ici'
        });
        if (result.isConfirmed) {
          logout();
          throw new Error('Authentification requise (401)');
        } else {
          setError('Session invalide (401) — reconnectez-vous si nécessaire.');
          return;
        }
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => null);
        console.debug('fetchHistorique: non-ok status', res.status, txt);
        throw new Error(`Erreur ${res.status}`);
      }
      const data = await res.json();
      // Debug: log payload and counts per type to help diagnose missing LIVRAISON entries
      try {
        const arr: any[] = data || [];
        const counts = arr.reduce((acc: any, it: any) => { acc[it.type] = (acc[it.type] || 0) + 1; return acc; }, {});
        console.debug('fetchHistorique', { endpoint, total: arr.length, counts, sample: arr.slice(0,5) });
      } catch (e) {
        console.debug('fetchHistorique: unable to compute debug counts', e);
      }
      setItems(data || []);
    } catch (err: any) {
      setError(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePaiementClient = async (id: number) => {
    const result = await Swal.fire({
      title: "Confirmer l'annulation",
      text: "Voulez-vous annuler ce paiement ?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, annuler',
      cancelButtonText: 'Annuler'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('smb_token');
        const res = await fetch(`http://localhost:8085/api/paiements-clients/${id}/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ reason: 'Annulation via historique' })
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => null);
          console.debug('paiement client cancel failed', res.status, txt);
          let msg = 'Impossible d\'annuler le paiement';
          try { const j = txt ? JSON.parse(txt) : null; if (j && j.error) msg += ': ' + j.error; } catch(e){}
          throw new Error(msg);
        }
        Swal.fire('Succès', 'Paiement annulé', 'success');
        fetchHistorique(viewingAnnulations);
        try {
          const cancelledItem = items.find(it => it.type === 'PAIEMENT' && it.id === id);
          const commandeId = cancelledItem ? cancelledItem.referenceCommandeId ?? null : null;
          window.dispatchEvent(new CustomEvent('paiement:cancelled', { detail: { paiementId: id, commandeId } }));
        } catch (e) {}
      } catch (e) {
        Swal.fire('Erreur', 'Impossible d\'annuler le paiement', 'error');
      }
    }
  };

  const handleDeleteLivraison = async (id: number) => {
    const result = await Swal.fire({
      title: "Confirmer l'annulation",
      text: "Voulez-vous annuler cette livraison ?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, annuler',
      cancelButtonText: 'Annuler'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('smb_token');
        const res = await fetch(`http://localhost:8085/api/livraisons/${id}/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ reason: 'Annulation via historique' })
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => null);
          console.debug('livraison cancel failed', res.status, txt);
          let msg = 'Impossible d\'annuler la livraison';
          try { const j = txt ? JSON.parse(txt) : null; if (j && j.error) msg += ': ' + j.error; } catch(e){}
          throw new Error(msg);
        }
        Swal.fire('Succès', 'Livraison annulée', 'success');
        fetchHistorique(viewingAnnulations);
      } catch (e) {
        Swal.fire('Erreur', 'Impossible d\'annuler la livraison', 'error');
      }
    }
  };

  const generatePdfForLivraison = async (livraisonId: number) => {
    try {
      Swal.fire({ title: 'Génération PDF...', didOpen: () => Swal.showLoading() });
      const token = localStorage.getItem('smb_token');

      // Try backend PDF first
      try {
        const res = await fetch(`http://localhost:8085/api/livraisons/${livraisonId}/pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error('Impossible de générer le PDF côté serveur');
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl);
        Swal.close();
        return;
      } catch (e) {
        // fallback to client-side generation
        console.warn('Backend livraison PDF failed, falling back to client-side generation', e);
      }

      // fetch livraison detail
      const res = await fetch(`http://localhost:8085/api/livraisons/${livraisonId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Impossible de récupérer le détail de la livraison');
      const detail = await res.json();

      // Build a PDF page styled like the reception/paiement PDFs
      const pdf = new jsPDF({ unit: 'pt', format: 'A4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const headerY = 40;

      // Try to include left/right small images similar to PHP sample (if available at paths)
      try {
        const leftUrl = '/assets/img/nido1.png';
        const rightUrl = '/assets/img/nutrilac.png';
        const tryFetch = async (u: string) => {
          try {
            const r = await fetch(u);
            if (r.ok) return await r.blob();
          } catch (e) {}
          return null;
        };
        const leftBlob = await tryFetch(leftUrl);
        if (leftBlob) {
          const imgData = await new Promise<string>((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result as string);
            fr.onerror = () => reject(fr);
            fr.readAsDataURL(leftBlob);
          });
          pdf.addImage(imgData, 'PNG', 10, headerY - 12, 38, 0);
        }
        const rightBlob = await tryFetch(rightUrl);
        if (rightBlob) {
          const imgData = await new Promise<string>((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result as string);
            fr.onerror = () => reject(fr);
            fr.readAsDataURL(rightBlob);
          });
          pdf.addImage(imgData, 'PNG', 118, headerY - 8, 30, 0);
        }
      } catch (e) {
        // ignore
      }

      if (detail.commandeClient && detail.commandeClient.boutique && detail.commandeClient.boutique.logo) {
        try {
          const logoUrl = detail.commandeClient.boutique.logo.startsWith('/') ? detail.commandeClient.boutique.logo : detail.commandeClient.boutique.logo;
          const resp = await fetch(logoUrl);
          if (resp.ok) {
            const blob = await resp.blob();
            const imgData = await new Promise<string>((resolve, reject) => {
              const r = new FileReader();
              r.onload = () => resolve(r.result as string);
              r.onerror = () => reject(r);
              r.readAsDataURL(blob);
            });
            pdf.addImage(imgData, 'PNG', (pageWidth - 80) / 2, headerY - 12, 80, 0);
          }
        } catch (e) {
          // ignore logo fetch errors
        }
      }

      // Centered boxed title
      const title = `BON DE LIVRAISON N : ${detail.reference || livraisonId}`;
      pdf.setLineWidth(0.9);
      pdf.setFontSize(12);
      const tw = pdf.getTextWidth(title);
      const rectW = tw + 12;
      const rectX = (pageWidth - rectW) / 2;
      pdf.rect(rectX, headerY + 8, rectW, 14);
      pdf.text(title, pageWidth / 2, headerY + 18, { align: 'center' });

      // Metadata centered below
      pdf.setFontSize(10);
      const fournisseurText = `CLIENT: ${detail.commandeClient?.client ? (detail.commandeClient.client.nom + ' ' + (detail.commandeClient.client.prenom || '')) : ''}   LIVRÉ le: ${formatServerDate(detail.dateLivraison) || ''}`;
      pdf.text(fournisseurText, pageWidth / 2, headerY + 36, { align: 'center' });

      // Table header
      let startY = headerY + 60;
      pdf.setFontSize(10);
      pdf.text('Désignation', 40, startY);
      pdf.text('Qté Cmd', 240, startY);
      pdf.text('Qté Livrée', 320, startY);
      pdf.text('Qté Restante', 420, startY);
      startY += 12;

      (detail.lignesLivraison || []).forEach((ligne: any, i: number) => {
        const y = startY + i * 14;
        pdf.text(ligne.designation || '', 40, y);
        pdf.text(String(ligne.qteCommande || ligne.quantiteCommande || ''), 240, y);
        pdf.text(String(ligne.qteLivree || ligne.quantiteLivre || ligne.quantiteRecu || ''), 320, y);
        pdf.text(String((ligne.qteCommande || ligne.quantiteCommande || 0) - (ligne.qteLivree || ligne.quantiteLivre || ligne.quantiteRecu || 0)), 420, y);
      });

      pdf.save(`livraison-${detail.reference || livraisonId}.pdf`);
      Swal.close();
    } catch (err: any) {
      Swal.close();
      Swal.fire('Erreur', err.message || 'Erreur génération PDF', 'error');
    }
  };

  const generatePdfForPaiementClient = async (paiementId: number) => {
    try {
      Swal.fire({ title: 'Génération PDF...', didOpen: () => Swal.showLoading() });
      const token = localStorage.getItem('smb_token');

      // Try backend PDF first
      try {
        const res = await fetch(`http://localhost:8085/api/paiements-clients/${paiementId}/pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error('Impossible de générer le PDF côté serveur');
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl);
        Swal.close();
        return;
      } catch (e) {
        // fallback to client-side generation
        console.warn('Backend paiement-client PDF failed, falling back to client-side generation', e);
      }

      const res = await fetch(`http://localhost:8085/api/paiements-clients/${paiementId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Impossible de récupérer le détail du paiement');
      const detail = await res.json();

      const pdf = new jsPDF({ unit: 'pt', format: 'A4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const headerY = 40;

      // try left/right small images
      try {
        const leftUrl = '/assets/img/nido1.png';
        const rightUrl = '/assets/img/nutrilac.png';
        const tryFetch = async (u: string) => {
          try { const r = await fetch(u); if (r.ok) return await r.blob(); } catch (e) {}
          return null;
        };
        const leftBlob = await tryFetch(leftUrl);
        if (leftBlob) {
          const imgData = await new Promise<string>((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result as string); fr.onerror = () => reject(fr); fr.readAsDataURL(leftBlob); });
          pdf.addImage(imgData, 'PNG', 10, headerY - 12, 38, 0);
        }
        const rightBlob = await tryFetch(rightUrl);
        if (rightBlob) {
          const imgData = await new Promise<string>((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result as string); fr.onerror = () => reject(fr); fr.readAsDataURL(rightBlob); });
          pdf.addImage(imgData, 'PNG', 118, headerY - 8, 30, 0);
        }
      } catch (e) {}

      if (detail.commandeClient && detail.commandeClient.boutique && detail.commandeClient.boutique.logo) {
        try {
          const logoUrl = detail.commandeClient.boutique.logo.startsWith('/') ? detail.commandeClient.boutique.logo : detail.commandeClient.boutique.logo;
          const resp = await fetch(logoUrl);
          if (resp.ok) {
            const blob = await resp.blob();
            const imgData = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = () => reject(r); r.readAsDataURL(blob); });
            pdf.addImage(imgData, 'PNG', (pageWidth - 80) / 2, headerY - 12, 80, 0);
          }
        } catch (e) {}
      }

      // title box
      const title = `PAIEMENT N : ${detail.reference || paiementId}`;
      pdf.setLineWidth(0.9);
      pdf.setFontSize(12);
      const tw = pdf.getTextWidth(title);
      const rectW = tw + 12;
      pdf.rect((pageWidth - rectW) / 2, headerY, rectW, 14);
      pdf.text(title, pageWidth / 2, headerY + 10, { align: 'center' });

      // Metadata
      pdf.setFontSize(10);
      const U = formatServerDate(detail.datePaie);
      pdf.text(`COMMANDE N : ${detail.commandeClient?.reference || ''}`, 40, headerY + 34);
      pdf.text(`ETABLIT LE: ${U}`, 40, headerY + 50);
      pdf.text(`PAR: ${detail.commandeClient?.utilisateur ? detail.commandeClient.utilisateur.nom + ' ' + detail.commandeClient.utilisateur.prenom : ''}`, 40, headerY + 66);

      const total = detail.commandeClient?.total || 0;
      const paid = detail.commandeClient?.paie != null ? detail.commandeClient.paie : 0;
      const remaining = Math.max(total - paid, 0);
      pdf.text(`MONTANT TOTAL/CMD: ${total.toLocaleString('fr-FR')} FCFA`, 40, headerY + 86);
      pdf.text(`MONTANT PAYÉ: ${paid.toLocaleString('fr-FR')} FCFA`, 220, headerY + 86);
      pdf.text(`MONTANT RESTANT: ${remaining.toLocaleString('fr-FR')} FCFA`, 380, headerY + 86);

      // Lines table
      if (detail.commandeClient && detail.commandeClient.lignes) {
        let startY = headerY + 110;
        pdf.setFontSize(10);
        pdf.text('Désignation', 40, startY);
        pdf.text('Qté Cmd', 240, startY);
        pdf.text('Qté Reçue', 320, startY);
        startY += 12;
        (detail.commandeClient.lignes || []).forEach((ligne: any, i: number) => {
          const y = startY + i * 14;
          pdf.text(ligne.designation || '', 40, y);
          pdf.text(String(ligne.quantite || ''), 240, y);
          pdf.text(String(ligne.quantiteLivre || ligne.quantiteLivre || ''), 320, y);
        });
      }

      pdf.save(`paiement-client-${detail.reference || paiementId}.pdf`);
      Swal.close();
    } catch (err: any) {
      Swal.close();
      Swal.fire('Erreur', err.message || 'Erreur génération PDF', 'error');
    }
  };

  const filtered = items.filter(i => {
    if (filterType !== 'ALL' && i.type !== filterType) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    // search in reference, referenceCommande, client, fournisseur or responsable
    const clientName = ((i.client || i.fournisseur) || '').toLowerCase();
    const responsableName = (i as any).responsable ? (i as any).responsable.toLowerCase() : '';
    return (i.reference && i.reference.toLowerCase().includes(s)) ||
      (i.referenceCommande && i.referenceCommande.toLowerCase().includes(s)) ||
      clientName.includes(s) || responsableName.includes(s);
  });

  // permission helpers
  const canAnnulerPaiement = useHasPermission('PAIEMENT_ANNULATION') || useHasPermission('PAIEMENT_SUPPRESSION');
  const canAnnulerLivraison = useHasPermission('RECEPTION_ANNULATION') || useHasPermission('RECEPTION_SUPPRESSION');
  const canSeeCaisse = useHasPermission('CAISSE_VOIR') || useHasPermission('CAISSE_LECTURE');

  return (
    <div className="container-fluid">
      <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Historique</div>
        <div className="ps-3">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 p-0">
              <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
              <li className="breadcrumb-item active" aria-current="page">Historique Ventes</li>
            </ol>
          </nav>
        </div>
      </div>

      <hr />

      <div className="row">
        <div className="col-12">
          <div className="card" style={{ minHeight: '65vh' }}>
            <div className="card-body" style={{ minHeight: '55vh' }}>
          <div className="d-flex mb-3">
            <div className="me-3">
              <label>Type:</label>
              <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
                <option value="ALL">Tout</option>
                <option value="LIVRAISON">Livraison</option>
                <option value="PAIEMENT">Paiement</option>
              </select>
            </div>
            <div className="flex-grow-1 ms-3">
              <label>Recherche (réf / client):</label>
              <input className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." />
            </div>
            <div className="ms-3">
              <label style={{ display: 'block' }}>Afficher annulations</label>
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="showAnnulations" checked={viewingAnnulations} onChange={(e) => setViewingAnnulations(e.target.checked)} />
                <label className="form-check-label" htmlFor="showAnnulations">Afficher</label>
              </div>
            </div>
          </div>

          {loading ? <p>Chargement...</p> : error ? <p className="text-danger">{error}</p> : (
            <div className="table-responsive">
              <table className="table table-striped table-bordered">
                <thead>
                  <tr>
                    <th>Date</th>
                    {filterType === 'PAIEMENT' && !viewingAnnulations ? (
                      <>
                        <th>Client</th>
                        <th>Responsable</th>
                        <th>Montant</th>
                        <th>Opérations</th>
                      </>
                    ) : (
                      <>
                        <th>Type</th>
                        <th>Référence</th>
                        {canSeeCaisse && <th>Réf Caisse</th>}
                        <th>Réf Commande</th>
                        <th>Client</th>
                        <th>Montant</th>
                        {viewingAnnulations ? <th>Annulé par</th> : <th>Opérations</th>}
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={`${item.type}-${item.id}`}>
                      <td>{formatServerDate(item.dateIso || item.date || '')}</td>

                      {filterType === 'PAIEMENT' && !viewingAnnulations ? (
                        <>
                          <td>{item.client ?? item.fournisseur}</td>
                          <td>{(item as any).responsable ?? '-'}</td>
                          <td>{item.montant != null ? item.montant.toFixed(0) : '-'}</td>
                          <td>
                            <button
                              className={`btn btn-sm btn-outline-primary me-1 ${item.referenceCommande ? '' : 'disabled'}`}
                              title={item.referenceCommande ? 'Détail commande' : 'Détail indisponible'}
                              onClick={() => { if (item.referenceCommandeId) navigate(`/ventes/appercu/${item.referenceCommandeId}`); }}
                            ><i className="ri-eye-line"></i></button>

                            <button
                              className={`btn btn-sm me-1 btn-outline-success`}
                              title={'Imprimer'}
                              onClick={() => { if (item.type === 'PAIEMENT') generatePdfForPaiementClient(item.id); }}
                            >
                              <i className="ri-printer-line"></i>
                            </button>

                            {canAnnulerPaiement && (
                              <button
                                className="btn btn-sm btn-outline-danger"
                                title="Supprimer"
                                onClick={() => handleDeletePaiementClient(item.id)}
                              >
                                <i className="ri-delete-bin-line"></i>
                              </button>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            {(() => {
                              const label = item.type ?? '';
                              const key = (label || '').toString().toUpperCase();
                              let cls = 'bg-secondary';
                              if (key.includes('PAIEMENT') || key.includes('ENTREE') || key.includes('CREDIT')) cls = 'bg-success';
                              else if (key.includes('LIVRAISON') || key.includes('RECEPTION') || key.includes('SORTIE') || key.includes('DEPENSE')) cls = 'bg-danger';
                              else cls = 'bg-secondary';
                              return <span className={`badge ${cls}`}>{label}</span>;
                            })()}
                          </td>
                          <td>{item.reference}</td>
                          {canSeeCaisse && <td>{item.referenceCaisse ?? '-'}</td>}
                          <td>{item.referenceCommande}</td>
                          <td>{item.client ?? item.fournisseur}</td>
                          <td>{item.montant != null ? item.montant.toFixed(0) : '-'}</td>
                          {viewingAnnulations ? (
                            <td>{item.annule ? (item.annuleParNom || (item.annulePar != null ? String(item.annulePar) : '-')) : '-'}</td>
                          ) : (
                            <td>
                              {/* Aperçu */}
                              {/* {item.referenceCommandeId ? (
                                <a className="btn btn-sm btn-outline-primary me-1" href={`/ventes/livraisons?venteId=${item.referenceCommandeId}`} title="Aperçu Commande"><i className="ri-eye-line"></i></a>
                              ) : (
                                <button className="btn btn-sm btn-outline-primary me-1 disabled" title="Aperçu indisponible"><i className="ri-eye-line"></i></button>
                              )} */}

                              {/* PDF Paiement (enabled for PAIEMENT rows) */}
                              <button
                                className={`btn btn-sm me-1 ${item.type === 'PAIEMENT' ? 'btn-outline-success' : 'btn-outline-secondary disabled'}`}
                                title={item.type === 'PAIEMENT' ? 'PDF Paiement' : 'PDF Paiement (non applicable)'}
                                onClick={() => { if (item.type === 'PAIEMENT') generatePdfForPaiementClient(item.id); }}
                              >
                                <i className="ri-wallet-2-line"></i>
                              </button>

                              {/* PDF Livraison (enabled for LIVRAISON rows) */}
                              <button
                                className={`btn btn-sm me-1 ${item.type === 'LIVRAISON' ? 'btn-outline-info' : 'btn-outline-secondary disabled'}`}
                                title={item.type === 'LIVRAISON' ? 'PDF Livraison' : 'PDF Livraison (non applicable)'}
                                onClick={() => { if (item.type === 'LIVRAISON') generatePdfForLivraison(item.id); }}
                              >
                                <i className="ri-truck-line"></i>
                              </button>

                              {/* Annulation (for paiement clients use DELETE endpoint if available) */}
                              {item.type === 'PAIEMENT' && canAnnulerPaiement && (
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  title="Annuler"
                                  onClick={() => handleDeletePaiementClient(item.id)}
                                >
                                  <i className="ri-close-line"></i>
                                </button>
                              )}

                              {item.type === 'LIVRAISON' && canAnnulerLivraison && (
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  title="Annuler"
                                  onClick={() => handleDeleteLivraison(item.id)}
                                >
                                  <i className="ri-close-line"></i>
                                </button>
                              )}
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
</div>
  );
};

export default VentesHistorique;
