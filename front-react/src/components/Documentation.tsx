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
          <h4 className="mb-0">DOCUMENTATION UTILISATEUR — JÀGO DÁNAYA</h4>
          <small className="text-muted">Dernière mise à jour : 26/01/2026</small>
        </div>
        <div className="btn-group">
          <button className="btn btn-outline-primary" onClick={downloadPdf} aria-label="Télécharger en PDF">Télécharger (PDF)</button>
          <button className="btn btn-outline-secondary" onClick={downloadWord} aria-label="Télécharger en Word">Télécharger (Word)</button>
        </div>
      </div>

      <div ref={docRef} className="documentation-content card p-4" style={{ maxWidth: 980 }}>
        <h1>DOCUMENTATION UTILISATEUR</h1>
        <h2>JÀGO DÁNAYA</h2>

        <p><strong>La gestion claire du commerce africain</strong><br />La confiance dans chaque chiffre</p>

        <h3>INTRODUCTION</h3>
        <p>JÀGO DÁNAYA est une application de gestion commerciale conçue pour s’adapter aux réalités africaines : vente par conditionnement, gestion des magasins, multi-boutiques, inventaire réel, caisse, crédits et rapports.</p>
        <p>Cette documentation explique comment utiliser l’application étape par étape, dans l’ordre logique réel, afin qu’un utilisateur puisse exploiter le système sans assistance extérieure.</p>
        <p>La boutique est déjà créée pour l’utilisateur à la première connexion. Aucune configuration de boutique n’est demandée au départ.</p>

        <h3>ÉTAPE 1 — CONFIGURATION DE BASE</h3>
        <h4>1.1 Configuration des unités (optionnelle)</h4>
        <p>Les unités servent à décrire comment les produits sont comptés (pièce, carton, sac, paquet…).</p>
        <p>Deux cas existent :</p>
        <ul>
          <li><strong>Enregistrement manuel des produits</strong><br />→ il est recommandé d’avoir au moins une unité.</li>
          <li><strong>Importation des produits</strong><br />→ l’enregistrement des unités est optionnel. Si l’option création automatique des unités est cochée, le système crée automatiquement les unités détectées dans le fichier importé et ne bloque jamais l’import pour absence d’unités.</li>
        </ul>

        <h4>1.2 Configuration de la marge et du CMP (OBLIGATOIRE)</h4>
        <p>Avant toute vente ou réception, la marge basée sur le CMP (Coût Moyen Pondéré) doit être configurée.</p>
        <p>La configuration permet de définir : le type de marge (fixe ou pourcentage), la marge pour le prix de détail, la marge pour le prix de gros, une marge minimale.</p>
        <p><strong>Principe fondamental :</strong></p>
        <ul>
          <li>le prix d’achat réel alimente le CMP,</li>
          <li>les prix de vente sont calculés automatiquement à partir du CMP,</li>
          <li>l’utilisateur ne modifie pas manuellement les prix à chaque achat.</li>
        </ul>
        <p>Cette configuration garantit la cohérence des prix, la traçabilité et la fiabilité des marges.</p>

        <h3>ÉTAPE 2 — PRODUITS</h3>
        <h4>2.1 Création manuelle d’un produit</h4>
        <p>Lors de la création d’un produit : le produit est rattaché à la boutique, un stock est automatiquement créé, la quantité initiale est toujours 0, aucun magasin n’est requis à ce stade.</p>
        <p>À ce moment : il n’y a ni achat, ni réception, ni mouvement financier.</p>

        <h4>2.2 Importation des produits</h4>
        <p>L’importation permet d’enregistrer plusieurs produits à la fois.</p>
        <p>Options importantes :</p>
        <ul>
          <li>import avec ou sans unités existantes,</li>
          <li>création automatique des unités si l’option est cochée,</li>
          <li>création automatique des stocks (quantité = 0).</li>
        </ul>
        <p>L’import ne crée aucune quantité réelle. Il prépare simplement les produits à être inventoriés.</p>

        <h3>ÉTAPE 3 — INVENTAIRE INITIAL (OBLIGATOIRE)</h3>
        <p>L’inventaire est l’étape la plus importante après les produits.</p>
        <p><strong>Pourquoi l’inventaire est obligatoire ?</strong></p>
        <ul>
          <li>les produits existent,</li>
          <li>le stock système est à 0,</li>
          <li>mais physiquement, la boutique ou le magasin possède déjà des marchandises.</li>
        </ul>
        <p>L’inventaire permet de déclarer les quantités réelles, d’initialiser le stock, de valoriser le stock sur la base du prix d’achat et de créer les premiers mouvements d’ajustement.</p>
        <p><strong>Comment faire un inventaire ?</strong></p>
        <ul>
          <li>Choisir l’emplacement : boutique ou magasin (si existant).</li>
          <li>Le système affiche uniquement les produits de la boutique ou ceux du magasin sélectionné.</li>
          <li>Saisir les quantités physiques (généralement par conditionnement).</li>
          <li>Le système convertit automatiquement en unités, calcule les écarts et valorise chaque ligne au prix d’achat.</li>
        </ul>
        <p>Régulariser l’inventaire : le stock est ajusté, des mouvements sont créés, l’inventaire devient verrouillé. Aucune vente ni réception ne doit être effectuée avant cette étape.</p>

        <h3>ÉTAPE 4 — ACHATS ET RÉCEPTIONS</h3>
        <h4>Commande fournisseur</h4>
        <p>La commande se fait principalement par conditionnement : cartons, sacs, paquets. Des achats à l’unité sont possibles mais restent exceptionnels.</p>
        <h4>Réception fournisseur</h4>
        <p>Lors de la réception : la quantité reçue est saisie, le système convertit en unités, le CMP est recalculé, le stock est mis à jour et des mouvements d’entrée sont créés.</p>

        <h3>ÉTAPE 5 — TRANSFERTS (SI MAGASINS)</h3>
        <p>Le transfert permet de déplacer le stock : du magasin vers la boutique ou entre magasins. Le transfert ne modifie pas le CMP ; il crée une sortie à la source et une entrée à la destination — tout est traçable par mouvement.</p>

        <h3>ÉTAPE 6 — VENTES</h3>
        <h4>Vente en espèces (caisse)</h4>
        <p>Les ventes se font généralement par conditionnement, parfois par unité (fractionnement).</p>
        <p><strong>Exemple réel :</strong> un carton contient 24 unités, le client achète 15 unités, le carton est ouvert, il reste 9 unités pour les ventes suivantes. Le système décrémente le stock en unités et conserve la logique du conditionnement.</p>
        <h4>Vente à crédit</h4>
        <p>Fonctionnement similaire à la vente en espèces, avec suivi des paiements, historique client et mouvements financiers distincts.</p>

        <h3>ÉTAPE 7 — CAISSE</h3>
        <p>La caisse gère uniquement l’argent : entrées, sorties, soldes. Elle est indépendante du stock mais liée aux ventes.</p>

        <h3>ÉTAPE 8 — MOUVEMENTS ET JOURNAL</h3>
        <p>La table des mouvements est le cœur du système. Elle trace ventes, réceptions, transferts, inventaires, ajustements et actions utilisateur. Elle permet filtrage par utilisateur, par date et audit complet de l’activité.</p>

        <h3>CONCLUSION</h3>
        <p>JÀGO DÁNAYA suit une logique simple mais rigoureuse :</p>
        <p><em>Produits → Inventaire → Achats → Stock → Ventes → Caisse → Rapports</em></p>
        <p>Respecter cet ordre garantit la fiabilité des chiffres, la confiance dans les marges et la transparence totale.</p>

        <hr />
        <p className="small text-muted">Ce document est fourni à titre d'aide utilisateur. Dernière mise à jour : 26/01/2026.</p>
      </div>
    </div>
  );
};

export default Documentation;
