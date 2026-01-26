import React, { useRef } from 'react';

// Lightweight documentation viewer with PDF / Word download (client-side)
const Documentation: React.FC = () => {
  const docRef = useRef<HTMLDivElement | null>(null);

  const downloadWord = () => {
    const el = docRef.current;
    if (!el) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Documentation - JÀGO DÁNAYA</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;color:#222} h1,h2{color:#0d6efd} ul{line-height:1.6}</style>
      </head><body>${el.innerHTML}</body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Documentation-JAGO-DANAYA.doc';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    const el = docRef.current;
    if (!el) return;

    // Try to use jsPDF.html (requires html2canvas). If not available, fallback to open print dialog.
    try {
      const { jsPDF } = await import('jspdf');
      // dynamic import of html2canvas if available — jsPDF will use it
      try { await import('html2canvas'); } catch (e) { /* optional */ }
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      // @ts-ignore - html is available at runtime in this jsPDF version
      await pdf.html(el, {
        callback: (doc: any) => {
          doc.save('Documentation-JAGO-DANAYA.pdf');
        },
        margin: [20, 20, 20, 20],
        x: 10,
        y: 10,
        html2canvas: { scale: 1 }
      });
      return;
    } catch (err) {
      // fallback: open printable window (user can Save as PDF)
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Documentation - JÀGO DÁNAYA</title>
        <style>body{font-family:Arial,Helvetica,sans-serif;color:#222;padding:20px} h1,h2{color:#0d6efd}</style>
        </head><body>${el.innerHTML}</body></html>`;
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => { w.print(); }, 500);
    }
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-0">DOCUMENTATION — Guide d'utilisation (A → Z)</h4>
          <small className="text-muted">Dernière mise à jour : 22/12/2025</small>
        </div>
        <div className="btn-group">
          <button className="btn btn-outline-primary" onClick={downloadPdf} aria-label="Télécharger en PDF">Télécharger (PDF)</button>
          <button className="btn btn-outline-secondary" onClick={downloadWord} aria-label="Télécharger en Word">Télécharger (Word)</button>
        </div>
      </div>

      <div ref={docRef} className="documentation-content card p-4" style={{ maxWidth: 980 }}>
        <h1>Bienvenue sur JÀGO DÁNAYA</h1>
        <p>JÀGO DÁNAYA est une solution de gestion commerciale complète conçue pour les petites et moyennes entreprises. Cette documentation vous guide pas‑à‑pas, de l'installation initiale à l'exploitation courante.</p>

        <h2>Démarrage rapide</h2>
        <h3>1. Création de compte</h3>
        <ol>
          <li>Téléchargez et installez l'application ou ouvrez l'interface web.</li>
          <li>Cliquez sur <strong>S'inscrire</strong>.</li>
          <li>Remplissez vos informations (nom, email, téléphone).</li>
          <li>Vérifiez votre email ou numéro de téléphone.</li>
          <li>Connectez‑vous à votre compte.</li>
        </ol>

        <h3>2. Configuration initiale</h3>
        <p>Après création du compte :</p>
        <ul>
          <li>Configurez les informations de votre entreprise (Paramètres → Boutique).</li>
          <li>Ajoutez vos premiers produits / services (Produits → Nouveau produit).</li>
          <li>Créez votre premier client (Clients → Nouveau client).</li>
        </ul>

        <h2>Fonctionnalités principales</h2>
        <h3>Point de Vente (POS)</h3>
        <ul>
          <li>Enregistrer des ventes rapidement.</li>
          <li>Gérer paiements (espèces, mobile money).</li>
          <li>Imprimer / envoyer des reçus par email ou SMS.</li>
          <li>Suivi des ventes en temps réel.</li>
        </ul>

        <h3>Gestion de stock</h3>
        <ul>
          <li>Inventaire : visualisez tous vos articles en stock.</li>
          <li>Catégories : organisez vos produits.</li>
          <li>Alertes : notifications quand le stock est bas.</li>
          <li>Mouvements : suivez entrées et sorties.</li>
        </ul>

        <h3>Facturation</h3>
        <ul>
          <li>Créez devis et factures professionnelles.</li>
          <li>Personnalisez templates et envoyez par email/WhatsApp.</li>
        </ul>

        <h3>Support & FAQ</h3>
        <p>Besoin d'aide ?</p>
        <ul>
          <li>Email : <a href="mailto:support@umdynastie.com">support@umdynastie.com</a></li>
          <li>Téléphone / WhatsApp : +223 92 03 06 03</li>
        </ul>

        <h2>Annexes</h2>
        <p>Pour toute exportation, sauvegarde ou récupération, consultez <em>Paramètres → Sauvegarde</em>. Le guide complet ci‑dessus couvre les flux courants (POS, gestion stock, facturation, CRM, comptabilité).</p>

        <hr />
        <p className="small text-muted">Ce document est fourni à titre d'aide utilisateur. Dernière mise à jour : 22/12/2025.</p>
      </div>
    </div>
  );
};

export default Documentation;
