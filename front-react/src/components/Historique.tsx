import React, { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';

interface HistoriqueItem {
  type: 'RECEPTION' | 'PAIEMENT';
  id: number;
  date: string | null;
  reference: string | null;
  referenceCommandeId?: number | null;
  referenceCommande: string | null;
  fournisseur: string | null;
  montant?: number | null;
}

const Historique: React.FC = () => {
  const { currentBoutique } = useUser();
  const [items, setItems] = useState<HistoriqueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'RECEPTION' | 'PAIEMENT'>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (currentBoutique) fetchHistorique();
  }, [currentBoutique]);

  const fetchHistorique = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/historique/boutique/${currentBoutique?.id}`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePaiement = async (id: number) => {
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
        const res = await fetch(`http://localhost:8085/api/paiements/${id}`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error('Erreur lors de l\'annulation');
        Swal.fire('Succès', 'Paiement annulé', 'success');
        fetchHistorique();
      } catch (e) {
        Swal.fire('Erreur', 'Impossible d\'annuler le paiement', 'error');
      }
    }
  };

  // Cancel reception (annulation)
  const handleCancelReception = async (id: number) => {
    const result = await Swal.fire({
      title: "Confirmer l'annulation",
      text: "Voulez-vous annuler cette réception ?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, annuler',
      cancelButtonText: 'Annuler'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('smb_token');
        const res = await fetch(`http://localhost:8085/api/receptions/${id}`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error('Erreur lors de l\'annulation');
        Swal.fire('Succès', 'Réception annulée', 'success');
        fetchHistorique();
      } catch (e) {
        Swal.fire('Erreur', 'Impossible d\'annuler la réception', 'error');
      }
    }
  };

  // PDF generation helpers (client-side using jsPDF)
  const generatePdfForReception = async (receptionId: number) => {
    try {
      Swal.fire({ title: 'Génération PDF...', didOpen: () => Swal.showLoading() });
      const token = localStorage.getItem('smb_token');
      // Try backend PDF first
      try {
        const res = await fetch(`http://localhost:8085/api/receptions/${receptionId}/pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error('Impossible de générer le PDF côté serveur');
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl);
        Swal.close();
        return;
      } catch (e) {
        // fallback to client-side generation
        console.warn('Backend PDF failed, falling back to client-side generation', e);
      }

      // fetch reception detail
      const res = await fetch(`http://localhost:8085/api/receptions/${receptionId}/detail`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Impossible de récupérer le détail de la réception');
      const detail = await res.json();

      // Build a PDF page styled like the PHP header
      const pdf = new jsPDF({ unit: 'pt', format: 'A4' });

      // Try to include boutique logo if available
      const pageWidth = pdf.internal.pageSize.getWidth();
      const headerY = 40;

      // try to include left/right small images similar to PHP sample (if available at paths)
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

      if (detail.commandeFournisseur && detail.commandeFournisseur.boutique && detail.commandeFournisseur.boutique.logo) {
        try {
          const logoUrl = detail.commandeFournisseur.boutique.logo.startsWith('/') ? detail.commandeFournisseur.boutique.logo : detail.commandeFournisseur.boutique.logo;
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
      const title = `BON DE RECEPTION N : ${detail.reference || receptionId}`;
      pdf.setLineWidth(0.9);
      pdf.setFontSize(12);
      const tw = pdf.getTextWidth(title);
      const rectW = tw + 12;
      const rectX = (pageWidth - rectW) / 2;
      pdf.rect(rectX, headerY + 8, rectW, 14);
      pdf.text(title, pageWidth / 2, headerY + 18, { align: 'center' });

      // Metadata centered below
      pdf.setFontSize(10);
      const fournisseurText = `FOURNISSEUR: ${detail.fournisseur || ''}   RECU le: ${detail.dateReception || ''}`;
      pdf.text(fournisseurText, pageWidth / 2, headerY + 36, { align: 'center' });

      // Table header
      let startY = headerY + 60;
      pdf.setFontSize(10);
      pdf.text('Désignation', 40, startY);
      pdf.text('Qté Cmd', 240, startY);
      pdf.text('Qté Reçue', 320, startY);
      pdf.text('Qté Restante', 420, startY);
      startY += 12;

      (detail.lignesReception || []).forEach((ligne: any, i: number) => {
        const y = startY + i * 14;
        pdf.text(ligne.designation || '', 40, y);
        pdf.text(String(ligne.qteCommande || ''), 240, y);
        pdf.text(String(ligne.qteRecue || ''), 320, y);
        pdf.text(String((ligne.qteCommande || 0) - (ligne.qteRecue || 0)), 420, y);
      });

      pdf.save(`reception-${detail.reference || receptionId}.pdf`);
      Swal.close();
    } catch (err: any) {
      Swal.close();
      Swal.fire('Erreur', err.message || 'Erreur génération PDF', 'error');
    }
  };


  // PDF for Paiement (server-first, fallback to client-side formatted like PHP)
  const generatePdfForPaiement = async (paiementId: number) => {
    try {
      Swal.fire({ title: 'Génération PDF...', didOpen: () => Swal.showLoading() });
      const token = localStorage.getItem('smb_token');

      // Try server
      try {
        const res = await fetch(`http://localhost:8085/api/paiements/${paiementId}/pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error('Impossible de générer le PDF côté serveur');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        Swal.close();
        return;
      } catch (e) {
        console.warn('Backend paiement PDF failed, falling back to client-side generation', e);
      }

      // Fallback: fetch paiement and render like PHP
      const res = await fetch(`http://localhost:8085/api/paiements/${paiementId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Impossible de récupérer le paiement');
      const paie = await res.json();

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
        const lb = await tryFetch(leftUrl);
        if (lb) {
          const d = await new Promise<string>((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result as string); fr.onerror = () => reject(fr); fr.readAsDataURL(lb); });
          pdf.addImage(d, 'PNG', 10, headerY - 12, 38, 0);
        }
        const rb = await tryFetch(rightUrl);
        if (rb) {
          const d = await new Promise<string>((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result as string); fr.onerror = () => reject(fr); fr.readAsDataURL(rb); });
          pdf.addImage(d, 'PNG', 118, headerY - 8, 30, 0);
        }
      } catch (e) {}

      // title box
      const title = `PAIEMENT N : ${paie.reference || paiementId}`;
      pdf.setLineWidth(0.9);
      pdf.setFontSize(12);
      const tw = pdf.getTextWidth(title);
      const rectW = tw + 12;
      pdf.rect((pageWidth - rectW) / 2, headerY, rectW, 14);
      pdf.text(title, pageWidth / 2, headerY + 10, { align: 'center' });

      // Metadata
      pdf.setFontSize(10);
      const U = formatServerDateString(paie.datePaie);
      pdf.text(`COMMANDE N : ${paie.commandeFournisseur?.reference || ''}`, 40, headerY + 34);
      pdf.text(`ETABLIT LE: ${U}`, 40, headerY + 50);
      pdf.text(`PAR: ${paie.commandeFournisseur?.utilisateur ? paie.commandeFournisseur.utilisateur.nom + ' ' + paie.commandeFournisseur.utilisateur.prenom : ''}`, 40, headerY + 66);

      const total = paie.commandeFournisseur?.total || 0;
      const paid = paie.commandeFournisseur?.paie != null ? paie.commandeFournisseur.paie : 0;
      const remaining = Math.max(total - paid, 0);
      pdf.text(`MONTANT TOTAL/CMD: ${total.toLocaleString('fr-FR')} FCFA`, 40, headerY + 86);
      pdf.text(`MONTANT PAYÉ: ${paid.toLocaleString('fr-FR')} FCFA`, 220, headerY + 86);
      pdf.text(`MONTANT RESTANT: ${remaining.toLocaleString('fr-FR')} FCFA`, 380, headerY + 86);

      // Lines table
      if (paie.commandeFournisseur && paie.commandeFournisseur.lignes) {
        let startY = headerY + 110;
        pdf.setFontSize(10);
        pdf.text('Désignation', 40, startY);
        pdf.text('Qté Cmd', 240, startY);
        pdf.text('Qté Reçue', 320, startY);
        startY += 12;
        (paie.commandeFournisseur.lignes || []).forEach((ligne: any, i: number) => {
          const y = startY + i * 14;
          pdf.text(ligne.designation || '', 40, y);
          pdf.text(String(ligne.quantite || ''), 240, y);
          pdf.text(String(ligne.quantiteLivre || ''), 320, y);
        });
      }

      pdf.save(`paiement-${paie.reference || paiementId}.pdf`);
      Swal.close();
    } catch (err: any) {
      Swal.close();
      Swal.fire('Erreur', err.message || 'Erreur génération PDF', 'error');
    }
  };

  // Helper to parse server date strings safely without introducing timezone shifts
  const formatServerDateString = (d?: string | null) => {
    if (!d) return '';
    // If it's already in display format (dd/MM/yyyy ...) just return it
    if (d.includes('/')) return d;
    // If it's an ISO-like string without timezone (yyyy-MM-ddTHH:mm or yyyy-MM-ddTHH:mm:ss)
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(d)) {
      return d.replace('T', ' ');
    }
    // Otherwise fallback to Date parsing
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleString();
  };

  const filtered = items.filter(i => {
    if (filterType !== 'ALL' && i.type !== filterType) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (i.reference && i.reference.toLowerCase().includes(s)) ||
      (i.referenceCommande && i.referenceCommande.toLowerCase().includes(s)) ||
      (i.fournisseur && i.fournisseur.toLowerCase().includes(s));
  });

  return (
    <div className="container-fluid historique-page">
      {/* Breadcrumb styled like Produit */}
      <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Historique</div>
        <div className="ps-3">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 p-0">
              <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
              <li className="breadcrumb-item active" aria-current="page">Réceptions & Paiements</li>
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
          <div className="card" style={{ minHeight: '65vh' }}>
            <div className="card-body" style={{ minHeight: '55vh' }}>
          <div className="d-flex mb-3">
            <div className="me-3">
              <label>Type:</label>
              <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
                <option value="ALL">Tout</option>
                <option value="RECEPTION">Réception</option>
                <option value="PAIEMENT">Paiement</option>
              </select>
            </div>
            <div className="flex-grow-1 ms-3">
              <label>Recherche (réf / fournisseur):</label>
              <input className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." />
            </div>
          </div>

          {loading ? <p>Chargement...</p> : error ? <p className="text-danger">{error}</p> : (
            <div className="table-responsive">
              <table className="table table-striped table-bordered">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Référence</th>
                    <th>Réf Commande</th>
                    <th>Fournisseur</th>
                    <th>Montant</th>
                    <th>Opérations</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={`${item.type}-${item.id}`}>
                      <td>{formatServerDateString(item.date || '')}</td>
                      <td>{item.type}</td>
                      <td>{item.reference}</td>
                      <td>{item.referenceCommande}</td>
                      <td>{item.fournisseur}</td>
                      <td>{item.montant != null ? item.montant.toFixed(0) : '-'}</td>
                      <td>
                        {/* Unified operations: Aperçu, PDF Paiement, PDF Réception, Annulation */}
                        <>
                          {/* Aperçu */}
                          {item.type === 'RECEPTION' ? (
                            <a className="btn btn-sm btn-outline-primary me-1" href={`/receptions/${item.id}`} title="Aperçu"><i className="ri-eye-line"></i></a>
                          ) : (
                            item.referenceCommandeId ? (
                              <a className="btn btn-sm btn-outline-primary me-1" href={`/commandes/appercu/${item.referenceCommandeId}`} title="Aperçu Commande"><i className="ri-eye-line"></i></a>
                            ) : (
                              <button className="btn btn-sm btn-outline-primary me-1 disabled" title="Aperçu indisponible"><i className="ri-eye-line"></i></button>
                            )
                          )}

                          {/* PDF Paiement (enabled for PAIEMENT rows) */}
                          <button
                            className={`btn btn-sm me-1 ${item.type === 'PAIEMENT' ? 'btn-outline-success' : 'btn-outline-secondary disabled'}`}
                            title={item.type === 'PAIEMENT' ? 'PDF Paiement' : 'PDF Paiement (non applicable)'}
                            onClick={() => { if (item.type === 'PAIEMENT') generatePdfForPaiement(item.id); }}
                          >
                            <i className="ri-wallet-2-line"></i>
                          </button>

                          {/* PDF Réception (always enabled) */}
                          <button
                            className={`btn btn-sm me-1 btn-outline-info`}
                            title={'PDF Réception'}
                            onClick={() => {
                              if (item.type === 'RECEPTION') {
                                generatePdfForReception(item.id);
                              } else if (item.type === 'PAIEMENT' && item.referenceCommandeId) {
                                // open last reception for this commande
                                (async () => {
                                  try {
                                    Swal.fire({ title: 'Téléchargement...', didOpen: () => Swal.showLoading() });
                                    const token = localStorage.getItem('smb_token');
                                    const res = await fetch(`http://localhost:8085/api/receptions/commande/${item.referenceCommandeId}/last/pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                                    if (!res.ok) throw new Error('Aucune réception trouvée pour cette commande');
                                    const blob = await res.blob();
                                    const url = URL.createObjectURL(blob);
                                    window.open(url, '_blank');
                                    Swal.close();
                                  } catch (e: any) {
                                    Swal.close();
                                    Swal.fire('Erreur', e.message || 'Erreur téléchargement PDF', 'error');
                                  }
                                })();
                              } else {
                                Swal.fire('Info', "Aucune réception liée à cet élément", 'info');
                              }
                            }}
                          >
                            <i className="ri-truck-line"></i>
                          </button>

                          {/* Annulation (cancel) - replaces supprimer */}
                          <button
                            className="btn btn-sm btn-outline-danger"
                            title="Annuler"
                            onClick={() => {
                              if (item.type === 'PAIEMENT') handleDeletePaiement(item.id);
                              else if (item.type === 'RECEPTION') handleCancelReception(item.id);
                            }}
                          >
                            <i className="ri-close-line"></i>
                          </button>
                        </>
                      </td>
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

export default Historique;
