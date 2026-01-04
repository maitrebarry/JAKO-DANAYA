import React, { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import useHasPermission from '../contexts/useHasPermission';
import { formatServerDate } from '../utils/date';

interface HistoriqueItem {
  type: 'RECEPTION' | 'PAIEMENT';
  id: number;
  date: string | null;
  dateIso?: string | null;
  reference: string | null;
  referenceCommandeId?: number | null;
  referenceCommande: string | null;
  fournisseur: string | null;
  montant?: number | null;
  // cancellation metadata
  annule?: boolean | null;
  annuleAt?: string | null;
  annuleReason?: string | null;
  annulePar?: number | null;
  annuleParNom?: string | null;
}

const Historique: React.FC = () => {
  const { currentBoutique, logout } = useUser();
  const canAnnulerPaiement = useHasPermission('PAIEMENT_ANNULATION') || useHasPermission('PAIEMENT_SUPPRESSION');
  const canAnnulerReception = useHasPermission('RECEPTION_ANNULATION') || useHasPermission('RECEPTION_SUPPRESSION');
  const [viewingAnnulations, setViewingAnnulations] = useState(false);
  const [items, setItems] = useState<HistoriqueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'RECEPTION' | 'PAIEMENT'>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (currentBoutique) fetchHistorique(viewingAnnulations);
  }, [currentBoutique, viewingAnnulations]);

  const fetchHistorique = async (annulations = false) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('smb_token');
      console.debug('fetchHistorique - token present?', !!token, 'token preview:', token ? token.slice(0,10) + '...' : null);
      const endpoint = annulations ? `/api/historique/annulations/boutique/${currentBoutique?.id}` : `/api/historique/boutique/${currentBoutique?.id}`;
      const res = await fetch(`http://localhost:8085${endpoint}`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (res.status === 401) {
        const body = await res.text().catch(() => null);
        console.debug('fetchHistorique - 401 body:', body);
        // session expired or token invalid -> notify user and force logout
        await Swal.fire({ icon: 'warning', title: 'Session expirée', text: 'Votre session est expirée ou non authentifiée. Vous allez être redirigé vers la connexion.' });
        logout();
        throw new Error('Authentification requise (401)');
      }
      if (!res.ok) {
        const body = await res.text().catch(() => null);
        console.debug('fetchHistorique - error body:', body);
        throw new Error(`Erreur ${res.status}`);
      }
      const data = await res.json();
      try { console.debug('Historique API sample:', (data || []).slice(0,10).map((i: any) => ({ id: i.id, type: i.type, date: i.date, dateIso: i.dateIso }))); } catch(e) {}
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
        const res = await fetch(`http://localhost:8085/api/paiements/${id}/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ reason: 'Annulation via historique' })
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => null);
          console.debug('paiement cancel failed', res.status, txt);
          let msg = 'Impossible d\'annuler le paiement';
          try { const j = txt ? JSON.parse(txt) : null; if (j && j.error) msg += ': ' + j.error; } catch(e){}
          throw new Error(msg);
        }
        Swal.fire('Succès', 'Paiement annulé', 'success');
        // Refresh historique list
        fetchHistorique(viewingAnnulations);

        // Notify other pages that a paiement has been cancelled so they can refresh
        try {
          const cancelledItem = items.find(it => it.type === 'PAIEMENT' && it.id === id);
          const commandeId = cancelledItem ? cancelledItem.referenceCommandeId ?? null : null;
          window.dispatchEvent(new CustomEvent('paiement:cancelled', { detail: { paiementId: id, commandeId } }));
        } catch (e) {
          // ignore dispatch errors
        }
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
        const res = await fetch(`http://localhost:8085/api/receptions/${id}/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ reason: 'Annulation via historique' })
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => null);
          console.debug('reception cancel failed', res.status, txt);
          let msg = 'Impossible d\'annuler la réception';
          try { const j = txt ? JSON.parse(txt) : null; if (j && j.error) msg += ': ' + j.error; } catch(e){}
          throw new Error(msg);
        }
        Swal.fire('Succès', 'Réception annulée', 'success');
        fetchHistorique(viewingAnnulations);
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

      // Top metadata block (Réf / Date / Commande)
      pdf.setFontSize(10);
      const metaX = 40;
      pdf.text(`Réf: ${detail.reference || receptionId}`, metaX, headerY + 18);
      pdf.text(`Date: ${formatServerDate(detail.dateReception) || ''}`, metaX, headerY + 34);
      pdf.text(`Commande: ${detail.commandeFournisseur?.reference || ''}`, metaX, headerY + 50);

      // Boutique info centered above the title (fallback to sensible defaults)
      pdf.setFontSize(11);
      const boutiqueName = detail.commandeFournisseur?.boutique?.nom || 'MAKAN-SERVICE';
      const boutiquePhone = detail.commandeFournisseur?.boutique?.telephone || '76543218';
      const boutiqueVille = detail.commandeFournisseur?.boutique?.ville || 'Kayes';
      pdf.text(boutiqueName, pageWidth / 2, headerY + 12, { align: 'center' });
      pdf.setFontSize(10);
      pdf.text(`${boutiquePhone}`, pageWidth / 2, headerY + 26, { align: 'center' });
      pdf.text(`${boutiqueVille}`, pageWidth / 2, headerY + 40, { align: 'center' });

      // Centered boxed title
      const title = `BON DE RECEPTION N : ${detail.reference || receptionId}`;
      pdf.setLineWidth(0.9);
      pdf.setFontSize(12);
      const tw = pdf.getTextWidth(title);
      const rectW = tw + 12;
      const rectX = (pageWidth - rectW) / 2;
      pdf.rect(rectX, headerY + 54, rectW, 14);
      pdf.text(title, pageWidth / 2, headerY + 66, { align: 'center' });

      // Supplier / received date centered below
      pdf.setFontSize(10);
      const fournisseurText = `FOURNISSEUR: ${detail.fournisseur || ''}   RECU le: ${formatServerDate(detail.dateReception) || ''}`;
      pdf.text(fournisseurText, pageWidth / 2, headerY + 84, { align: 'center' });

      // Table header for reception lines
      let startY = headerY + 104;
      pdf.setFontSize(10);
      pdf.text('DÉSIGNATION', 40, startY);
      pdf.text('QTÉ CMD', 240, startY);
      pdf.text('QTÉ REÇUE', 340, startY);
      pdf.text('QTÉ RESTANTE', 460, startY);
      startY += 12;

      // Render each reception line with conditionnement-aware designation and qty displays
      (detail.lignesReception || []).forEach((ligne: any, i: number) => {
        const y = startY + i * 20;
        const mul = ligne.nombreUnitesParConditionnement || 1;
        const unitLabel = ligne.uniteConditionnementLibelle || 'carton';
        const condCmd = (ligne.quantiteConditionnement && ligne.quantiteConditionnement > 0) ? ligne.quantiteConditionnement : ((mul > 1 && ligne.qteCommande % mul === 0) ? Math.floor(ligne.qteCommande / mul) : null);

        if (condCmd) {
          const approx = mul ? `(# ${ligne.qteCommande} u — 1 ${unitLabel} = ${mul} u )` : '';
          pdf.setFontSize(10);
          pdf.text(`${condCmd} ${unitLabel} de ${ligne.designation || ''}`, 40, y);
          pdf.setFontSize(9);
          if (approx) pdf.text(`${approx}`, 40, y + 10);
          pdf.setFontSize(10);

          const qCmdDisplay = `${condCmd} ${unitLabel}`;
          const condRec = (ligne.quantiteConditionnementRecueThis && ligne.quantiteConditionnementRecueThis > 0) ? ligne.quantiteConditionnementRecueThis : ((mul > 1 && (ligne.qteRecue || 0) % mul === 0) ? Math.floor((ligne.qteRecue || 0) / mul) : null);
          const qRecDisplay = condRec ? `${condRec} ${unitLabel}` : String(ligne.qteRecue || 0);
          const condRest = (ligne.quantiteConditionnementRestante && ligne.quantiteConditionnementRestante > 0) ? ligne.quantiteConditionnementRestante : ((mul > 1 && (ligne.receptionActuelle || 0) % mul === 0) ? Math.floor((ligne.receptionActuelle || 0) / mul) : null);
          const qRestDisplay = condRest ? `${condRest} ${unitLabel}` : String(ligne.receptionActuelle || 0);

          pdf.text(qCmdDisplay, 240, y);
          pdf.text(qRecDisplay, 340, y);
          pdf.text(qRestDisplay, 460, y);
        } else {
          pdf.setFontSize(10);
          pdf.text(ligne.designation || '', 40, y);
          pdf.text(String(ligne.qteCommande || ''), 240, y);
          pdf.text(String(ligne.qteRecue || ''), 340, y);
          pdf.text(String(ligne.receptionActuelle || ''), 460, y);
        }
      });

      // Signature line and footer company info
      let afterLinesY = startY + Math.max((detail.lignesReception || []).length * 20, 20) + 20;
      pdf.setFontSize(10);
      pdf.text('Signature: __________________________', 40, afterLinesY);

      // Repeated company footer
      afterLinesY += 24;
      pdf.text(boutiqueName, 40, afterLinesY);
      pdf.text(boutiquePhone, 40, afterLinesY + 14);
      pdf.text(boutiqueVille, 40, afterLinesY + 28);

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
      const U = formatServerDate(paie.datePaie);
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
          const y = startY + i * 18;
          if (ligne.quantiteConditionnement && ligne.quantiteConditionnement > 0) {
            pdf.text(ligne.designation || '', 40, y);
            const approx = ligne.nombreUnitesParConditionnement ? `≈ ${ligne.quantiteConditionnement * ligne.nombreUnitesParConditionnement} u` : `(${ligne.quantiteConditionnement} carton)`;
            pdf.setFontSize(9);
            pdf.text(`${ligne.quantiteConditionnement} carton ${approx}`, 40, y + 10);
            pdf.setFontSize(10);
            pdf.text(String(ligne.quantite || ''), 240, y);
            pdf.text(String(ligne.quantiteLivre || ''), 320, y);
          } else {
            pdf.text(ligne.designation || '', 40, y);
            pdf.text(String(ligne.quantite || ''), 240, y);
            pdf.text(String(ligne.quantiteLivre || ''), 320, y);
          }
        });
      }

      pdf.save(`paiement-${paie.reference || paiementId}.pdf`);
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
                    <th>Type</th>
                    <th>Référence</th>
                    <th>Réf Commande</th>
                    <th>Fournisseur</th>
                    <th>Montant</th>
                    {viewingAnnulations ? <th>Annulé par</th> : <th>Opérations</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={`${item.type}-${item.id}`}>
                      <td>{formatServerDate(item.dateIso || item.date || '')}</td>
                      <td>
                        {(() => {
                          const label = item.type ?? '';
                          const key = (label || '').toString().toUpperCase();
                          let cls = 'bg-secondary';
                          if (key.includes('PAIEMENT') || key.includes('ENTREE') || key.includes('CREDIT')) cls = 'bg-success';
                          else if (key.includes('RECEPTION') || key.includes('LIVRAISON') || key.includes('SORTIE') || key.includes('DEPENSE')) cls = 'bg-danger';
                          else cls = 'bg-secondary';
                          return <span className={`badge ${cls}`}>{label}</span>;
                        })()}
                      </td>
                      <td>{item.reference}</td>
                      <td>{item.referenceCommande}</td>
                      <td>{item.fournisseur}</td>
                      <td>{item.montant != null ? item.montant.toFixed(0) : '-'}</td>
                      {viewingAnnulations ? (
                        <td>{item.annule ? (item.annuleParNom || (item.annulePar != null ? String(item.annulePar) : '-')) : '-'}</td>
                      ) : (
                        <td>
                          {/* Unified operations: Aperçu, PDF Paiement, PDF Réception, Annulation */}
                          {/* Aperçu : seulement pour les réceptions — suppression de l'aperçu de commande dans l'historique */}
                          {/* {item.type === 'RECEPTION' && (
                            <a className="btn btn-sm btn-outline-primary me-1" href={`/receptions/${item.id}`} title="Aperçu"><i className="ri-eye-line"></i></a>
                          )} */}

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
                          {item.type === 'PAIEMENT' && canAnnulerPaiement && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              title="Annuler"
                              onClick={() => handleDeletePaiement(item.id)}
                            >
                              <i className="ri-close-line"></i>
                            </button>
                          )}

                          {item.type !== 'PAIEMENT' && canAnnulerReception && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              title="Annuler"
                              onClick={() => handleCancelReception(item.id)}
                            >
                              <i className="ri-close-line"></i>
                            </button>
                          )}
                        </td>
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

export default Historique;
