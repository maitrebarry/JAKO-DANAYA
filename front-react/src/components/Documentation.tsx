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
        <p>JÀGO DÁNAYA est une application de gestion commerciale conçue pour les réalités africaines : vente par conditionnement, fractionnement à l’unité, multi-magasins, inventaire réel, caisse, crédits et traçabilité complète.</p>
        <p>Cette documentation explique comment utiliser l’application pas à pas, dans l’ordre réel d’utilisation, afin qu’un utilisateur puisse travailler sans assistance extérieure.</p>
        <p>À la première connexion :</p>
        <ul>
          <li>la boutique de l’utilisateur est déjà créée,</li>
          <li>aucune configuration de boutique n’est demandée.</li>
        </ul>

        <h3>ÉTAPE 1 — ACCÈS ET SÉCURITÉ</h3>
        <h4>Connexion</h4>
        <ul>
          <li>Connexion par email et mot de passe.</li>
          <li>Connexion possible avec Google (OAuth2).</li>
        </ul>
        <h4>Mot de passe oublié</h4>
        <ul>
          <li>L’utilisateur peut réinitialiser son mot de passe via email.</li>
          <li>Le lien est sécurisé et temporaire.</li>
        </ul>

        <h3>ÉTAPE 2 — CONFIGURATION ESSENTIELLE (AVANT TOUTE OPÉRATION)</h3>
        <h4>2.1 Configuration des unités (OPTIONNELLE)</h4>
        <p>Les unités servent à exprimer le conditionnement des produits : pièce, carton, sac, paquet, bidon, etc.</p>
        <p>Deux cas existent :</p>
        <ul>
          <li><strong>Saisie manuelle des produits</strong><br />Il est recommandé d’avoir au moins une unité.</li>
          <li><strong>Importation des produits</strong><br />L’enregistrement manuel des unités est optionnel. Si l’option création automatique des unités est cochée : le système crée automatiquement les unités détectées, l’importation ne sera jamais bloquée par l’absence d’unités.</li>
        </ul>

        <h4>2.2 Configuration de la marge et du CMP (OBLIGATOIRE)</h4>
        <p>Avant tout achat, réception ou vente, la marge basée sur le CMP doit être configurée.</p>
        <p>Le CMP (Coût Moyen Pondéré) représente le prix d’achat réel moyen du produit.</p>
        <p><strong>Principe fondamental :</strong></p>
        <ul>
          <li>chaque réception met à jour le CMP,</li>
          <li>les prix de vente sont calculés automatiquement à partir du CMP,</li>
          <li>l’utilisateur ne modifie pas les prix à chaque achat.</li>
        </ul>
        <p>La configuration permet de définir :</p>
        <ul>
          <li>type de marge : fixe ou pourcentage,</li>
          <li>marge détail,</li>
          <li>marge gros,</li>
          <li>marge minimale de sécurité.</li>
        </ul>
        <p>Sans cette configuration :</p>
        <ul>
          <li>les prix de vente ne sont pas fiables,</li>
          <li>les marges ne sont pas maîtrisées.</li>
        </ul>

        <h3>ÉTAPE 3 — PRODUITS</h3>
        <h4>3.1 Enregistrement manuel des produits</h4>
        <p>Lors de l’enregistrement :</p>
        <ul>
          <li>le produit est rattaché à la boutique,</li>
          <li>un stock est automatiquement créé,</li>
          <li>la quantité initiale est toujours à 0,</li>
          <li>aucun magasin n’est requis à ce stade.</li>
        </ul>
        <p>Aucun mouvement de stock ni financier n’est créé.</p>

        <h4>3.2 Importation des produits</h4>
        <p>L’importation permet de créer plusieurs produits à la fois.</p>
        <p>L’import :</p>
        <ul>
          <li>crée les produits,</li>
          <li>crée les stocks (quantité = 0),</li>
          <li>ne crée jamais de stock réel.</li>
        </ul>
        <p>Après l’importation, l’inventaire est obligatoire.</p>

        <h3>ÉTAPE 4 — INVENTAIRE INITIAL (OBLIGATOIRE)</h3>
        <p>L’inventaire permet d’introduire la réalité physique du stock dans le système.</p>
        <p><strong>Pourquoi l’inventaire est indispensable :</strong></p>
        <ul>
          <li>les produits existent,</li>
          <li>le stock système est à 0,</li>
          <li>mais les marchandises existent physiquement.</li>
        </ul>
        <p><strong>Fonctionnement</strong></p>
        <ul>
          <li>choisir l’emplacement : boutique ou magasin,</li>
          <li>seuls les produits de cet emplacement apparaissent,</li>
          <li>saisir les quantités physiques généralement par conditionnement.</li>
        </ul>
        <p><strong>Exemples réels :</strong> 100 cartons de Fanta, 50 cartons de sardines, 20 sacs de riz.</p>
        <p>Le système :</p>
        <ul>
          <li>convertit en unités,</li>
          <li>calcule les écarts,</li>
          <li>valorise le stock au prix d’achat,</li>
          <li>crée les mouvements d’ajustement.</li>
        </ul>
        <p>Une fois régularisé :</p>
        <ul>
          <li>l’inventaire est verrouillé,</li>
          <li>les ventes et réceptions sont autorisées.</li>
        </ul>

        <h3>ÉTAPE 5 — ACHATS ET RÉCEPTIONS</h3>
        <h4>Commande fournisseur</h4>
        <p>Les achats se font principalement par conditionnement : cartons, sacs, paquets. L’achat à l’unité reste possible mais exceptionnel.</p>
        <h4>Réception fournisseur</h4>
        <p>À la réception : la quantité reçue est saisie (conditionnement ou unité), conversion automatique en unités, recalcul du CMP, mise à jour du stock, création des mouvements d’entrée.</p>

        <h3>ÉTAPE 6 — TRANSFERTS (SI MAGASINS EXISTANTS)</h3>
        <p>Le transfert permet de déplacer le stock : du magasin vers la boutique, ou entre magasins.</p>
        <p><strong>Règles :</strong></p>
        <ul>
          <li>le CMP ne change jamais,</li>
          <li>une sortie est créée à la source,</li>
          <li>une entrée est créée à la destination,</li>
          <li>tout est traçable par mouvement.</li>
        </ul>

        <h3>ÉTAPE 7 — VENTES</h3>
        <h4>Vente en espèces (caisse)</h4>
        <p>Les ventes se font : généralement par conditionnement, parfois par unité (fractionnement).</p>
        <p><strong>Exemple réel :</strong> un carton contient 24 unités, un client achète 15 unités, le carton est ouvert, il reste 9 unités disponibles pour les ventes suivantes.</p>
        <p>Le système : décrémente toujours le stock en unités, conserve la logique du conditionnement pour l’affichage.</p>
        <h4>Vente à crédit</h4>
        <p>Fonctionnement identique à la vente en espèces, avec : suivi client, paiements différés, historique détaillé.</p>

        <h3>ÉTAPE 8 — CAISSE</h3>
        <p>La caisse gère uniquement l’argent : entrées, sorties, soldes. Elle est liée aux ventes mais indépendante du stock.</p>

        <h3>ÉTAPE 9 — MOUVEMENTS ET JOURNAL</h3>
        <p>La table des mouvements est le cœur du système. Elle trace : ventes, achats, réceptions, transferts, inventaires, ajustements, actions utilisateur.</p>
        <p>Elle permet : audit par utilisateur, filtrage par jour, semaine, mois, année, traçabilité totale.</p>

        <h3>CONCLUSION</h3>
        <p>La logique de JÀGO DÁNAYA repose sur un ordre strict :</p>
        <p><em>Produits → Inventaire → Achats → Stock → Ventes → Caisse → Rapports</em></p>
        <p>Respecter cet ordre garantit : la fiabilité des chiffres, la confiance dans les marges, la transparence totale.</p>

        <hr />
        <p className="small text-muted">Ce document est fourni à titre d'aide utilisateur. Dernière mise à jour : 26/01/2026.</p>
      </div>
    </div>
  );
};

export default Documentation;
