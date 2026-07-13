import React, { useEffect, useRef } from 'react';

import imgConnexion from '../assets/docs/01-connexion.jpg';
import imgDashboard from '../assets/docs/02-tableau-de-bord.png';
import imgConfigUnites from '../assets/docs/03-config-unites.png';
import imgConfigMarges from '../assets/docs/04-config-marges.png';
import imgProduitsListe from '../assets/docs/05-produits-liste.png';
import imgProduitAjouter from '../assets/docs/06-produit-ajouter.png';
import imgInventairesListe from '../assets/docs/07-inventaires-liste.png';
import imgInventaireNouveau from '../assets/docs/08-inventaire-nouveau.png';
import imgFournisseursListe from '../assets/docs/09-fournisseurs-liste.png';
import imgCommandeFournisseur from '../assets/docs/10-commande-fournisseur.png';
import imgListeCommandesFournisseurs from '../assets/docs/11-liste-commandes-fournisseurs.png';
import imgAchatsHistorique from '../assets/docs/12-achats-historique.png';
import imgTransfertStock from '../assets/docs/13-transfert-stock.png';
import imgVenteEspece from '../assets/docs/14-vente-espece.png';
import imgCommandeClient from '../assets/docs/15-commande-client.png';
import imgVentesHistorique from '../assets/docs/16-ventes-historique.png';
import imgCaisseRegistre from '../assets/docs/17-caisse-registre.png';
import imgDepenses from '../assets/docs/18-depenses.png';
import imgMouvements from '../assets/docs/19-mouvements.png';
import imgDocuments from '../assets/docs/20-documents.png';
import imgRapports from '../assets/docs/21-rapports.png';
import imgUtilisationsPertes from '../assets/docs/22-utilisations-pertes.png';
import imgConfigUtilisateurs from '../assets/docs/23-config-utilisateurs.png';

// ---------------------------------------------------------------------------
// Guide visuel, pas à pas, pour des utilisateurs qui lisent peu ou pas.
// Le contenu (GUIDE) est la SEULE source de vérité : l'écran, le PDF et le
// Word sont tous les trois générés à partir de ce même tableau, pour rester
// identiques et cohérents.
// ---------------------------------------------------------------------------

const COLORS: Record<string, string> = {
  bleu: '#0d6efd',
  vert: '#198754',
  orange: '#fd7e14',
  violet: '#6f42c1',
  rouge: '#dc3545',
  gris: '#495057',
};

interface GuideBlock {
  subtitle?: string;
  steps: string[];
  image: { src: string; alt: string };
  resume?: string;
}

interface GuideSection {
  id: string;
  num: string;
  title: string;
  color: string;
  icon: string;
  intro?: string;
  blocks: GuideBlock[];
}

const GUIDE: GuideSection[] = [
  {
    id: 'connexion', num: '1', title: 'Se connecter', color: COLORS.bleu, icon: 'bi bi-box-arrow-in-right',
    blocks: [{
      steps: [
        'Ouvre l’application JÀGO DÁNAYA.',
        'Tape ton email dans la première case.',
        'Tape ton mot de passe dans la deuxième case.',
        'Appuie sur le bouton bleu-vert « Connexion ».',
      ],
      image: { src: imgConnexion, alt: 'Écran de connexion de JÀGO DÁNAYA' },
      resume: 'Mot de passe oublié ? Appuie sur « Mot de passe oublié ? » en bas de l’écran.',
    }],
  },
  {
    id: 'tableau-de-bord', num: '2', title: 'Le tableau de bord', color: COLORS.bleu, icon: 'bi bi-speedometer2',
    blocks: [{
      steps: [
        'C’est le premier écran que tu vois après la connexion.',
        'Les carrés de couleur montrent les chiffres importants du jour : commandes, ventes, stock, argent en caisse.',
        'Le menu noir à gauche te permet d’aller partout dans l’application.',
      ],
      image: { src: imgDashboard, alt: 'Tableau de bord avec les chiffres de la boutique' },
    }],
  },
  {
    id: 'configuration', num: '3', title: 'Configuration de départ (une seule fois)', color: COLORS.gris, icon: 'bi bi-gear',
    intro: 'Avant de vendre ou d’acheter, fais ces deux réglages une seule fois.',
    blocks: [
      {
        subtitle: '3.1 — Les unités (carton, sac, paquet…)',
        steps: [
          'Dans le menu noir, clique sur « Configuration ».',
          'Clique sur « Unité ».',
          'Clique sur le bouton « + Unité » en haut à droite pour en ajouter une nouvelle.',
        ],
        image: { src: imgConfigUnites, alt: 'Liste des unités de conditionnement' },
        resume: 'Une unité, c’est comment tu ranges tes produits : carton, sac, paquet, pièce.',
      },
      {
        subtitle: '3.2 — Les marges (le calcul automatique des prix)',
        steps: [
          'Dans « Configuration », clique sur « Marges (configuration) ».',
          'Clique sur « Modifier » pour choisir combien tu ajoutes au prix d’achat.',
        ],
        image: { src: imgConfigMarges, alt: 'Configuration des marges de la boutique' },
        resume: 'Une fois réglé, l’application calcule toute seule le prix de vente quand tu achètes un produit. Tu n’as rien à calculer.',
      },
    ],
  },
  {
    id: 'produits', num: '4', title: 'Les produits', color: COLORS.vert, icon: 'bi bi-box-seam',
    blocks: [
      {
        subtitle: '4.1 — Voir tous tes produits',
        steps: [
          'Dans le menu noir, clique sur « Produits », puis « Liste produits ».',
          'Tu vois l’image, le nom et les prix de chaque produit.',
          'Utilise la case « Rechercher un produit » pour trouver vite un produit.',
        ],
        image: { src: imgProduitsListe, alt: 'Liste des produits de la boutique' },
      },
      {
        subtitle: '4.2 — Ajouter un nouveau produit',
        steps: [
          'Clique sur le bouton noir « Ajouter un article ».',
          'Écris le nom du produit dans la case « Nom ».',
          'Écris le prix que tu as payé dans « Prix d’achat ». Le prix de vente se remplit tout seul.',
          'Clique sur le bouton « Créer » en bas à droite.',
        ],
        image: { src: imgProduitAjouter, alt: 'Formulaire pour créer un nouveau produit' },
        resume: 'Un produit nouveau démarre toujours avec 0 en stock. Utilise l’inventaire pour dire combien tu en as vraiment.',
      },
    ],
  },
  {
    id: 'inventaire', num: '5', title: 'L’inventaire (compter ce que tu as)', color: COLORS.vert, icon: 'bi bi-clipboard-check',
    intro: 'L’inventaire sert à dire à l’application combien de marchandise tu as vraiment dans ta boutique.',
    blocks: [
      {
        subtitle: '5.1 — Voir les inventaires déjà faits',
        steps: ['Clique sur « Inventaire » puis « Liste des Inventaires ».'],
        image: { src: imgInventairesListe, alt: 'Liste des inventaires réalisés' },
      },
      {
        subtitle: '5.2 — Faire un nouvel inventaire',
        steps: [
          'Clique sur « Nouveau Inventaire ».',
          'Pour chaque produit, compte ce que tu as vraiment (par carton, par sac...).',
          'Écris le nombre dans la case « Quantité » de chaque produit.',
          'Une fois terminé, valide pour que le stock soit corrigé automatiquement.',
        ],
        image: { src: imgInventaireNouveau, alt: 'Création d’un nouvel inventaire' },
        resume: 'Fais toujours l’inventaire avant tes premières ventes, pour que les quantités soient justes.',
      },
    ],
  },
  {
    id: 'achats', num: '6', title: 'Les achats chez tes fournisseurs', color: COLORS.orange, icon: 'bi bi-cart',
    blocks: [
      {
        subtitle: '6.1 — Voir tes fournisseurs',
        steps: [
          'Clique sur « Fournisseur » puis « Liste des fournisseurs ».',
          'Pour ajouter un fournisseur, clique sur « + Fournisseur » en haut à droite.',
        ],
        image: { src: imgFournisseursListe, alt: 'Liste des fournisseurs' },
      },
      {
        subtitle: '6.2 — Commander chez un fournisseur',
        steps: [
          'Clique sur « Achats » puis « Commande ».',
          'Choisis le fournisseur dans la case en haut à droite.',
          'Choisis les produits et les quantités à commander, ils s’ajoutent dans le « Panier » à droite.',
        ],
        image: { src: imgCommandeFournisseur, alt: 'Création d’une commande fournisseur' },
      },
      {
        subtitle: '6.3 — Voir toutes les commandes',
        steps: ['Clique sur « Liste commandes fournisseurs » pour voir ce qui a été reçu et payé.'],
        image: { src: imgListeCommandesFournisseurs, alt: 'Liste des commandes fournisseurs' },
      },
      {
        subtitle: '6.4 — L’historique des réceptions et paiements',
        steps: ['Clique sur « Historique » pour voir toutes les réceptions et tous les paiements passés.'],
        image: { src: imgAchatsHistorique, alt: 'Historique des réceptions et paiements fournisseurs' },
        resume: 'Dès qu’une commande est reçue, le stock augmente tout seul.',
      },
    ],
  },
  {
    id: 'transfert', num: '7', title: 'Déplacer du stock entre magasins', color: COLORS.vert, icon: 'bi bi-arrow-left-right',
    blocks: [{
      steps: [
        'Clique sur « Produits » puis « Transfert ».',
        'Choisis d’où vient le stock (à gauche) et où il va (à droite).',
        'Coche les produits à déplacer et écris la quantité.',
        'Clique sur « Transférer ».',
      ],
      image: { src: imgTransfertStock, alt: 'Transfert de stock entre magasins' },
    }],
  },
  {
    id: 'ventes', num: '8', title: 'Vendre', color: COLORS.bleu, icon: 'bi bi-credit-card',
    blocks: [
      {
        subtitle: '8.1 — Une vente rapide (le client paie tout de suite)',
        steps: [
          'Clique sur « Vente en Espèce » dans le menu noir.',
          'Cherche le produit dans la case « Rechercher un produit » et ajoute-le au panier.',
          'Écris « Montant Reçu » : l’argent que le client te donne.',
          'Clique sur le bouton « Enregistrer la vente » en bas.',
        ],
        image: { src: imgVenteEspece, alt: 'Écran de vente en espèces' },
        resume: 'La monnaie à rendre au client s’affiche toute seule.',
      },
      {
        subtitle: '8.2 — Une vente à crédit ou en gros (commande client)',
        steps: [
          'Clique sur « Ventes » puis « Ajouter Vente ».',
          'Choisis le client, ou clique sur « + Ajouter » pour créer un nouveau client.',
          'Ajoute les produits achetés par le client.',
        ],
        image: { src: imgCommandeClient, alt: 'Création d’une commande client' },
        resume: 'Ce client pourra payer plus tard, en une ou plusieurs fois. Suis ses paiements dans « Liste commandes clients ».',
      },
      {
        subtitle: '8.3 — Voir toutes les ventes passées',
        steps: ['Clique sur « Historique Ventes ».'],
        image: { src: imgVentesHistorique, alt: 'Historique des ventes' },
      },
    ],
  },
  {
    id: 'caisse', num: '9', title: 'La caisse (l’argent de la journée)', color: COLORS.violet, icon: 'bi bi-wallet2',
    blocks: [{
      steps: [
        'Clique sur « Caisse » puis « Régistre de caisse ».',
        'Le matin, écris l’argent que tu as au début (« Montant Initial ») et clique sur « Sauvegarder » pour ouvrir la caisse.',
        'Le soir, clique sur « Fermer » pour fermer la caisse.',
        'Clique sur « Voir mouvements » pour voir chaque entrée et sortie d’argent.',
      ],
      image: { src: imgCaisseRegistre, alt: 'Registre de caisse' },
      resume: 'Ouvre toujours une caisse avant de faire une vente. Sans caisse ouverte, tu ne peux pas vendre.',
    }],
  },
  {
    id: 'depenses', num: '10', title: 'Les dépenses', color: COLORS.violet, icon: 'bi bi-cash-coin',
    blocks: [{
      steps: [
        'Clique sur « Dépenses » dans le menu noir.',
        'Écris pourquoi tu dépenses (« Libellé ») et combien (« Montant »).',
        'Clique sur « Créer ».',
        'Un responsable doit ensuite valider la dépense avant qu’elle sorte de la caisse.',
      ],
      image: { src: imgDepenses, alt: 'Création et suivi des dépenses' },
    }],
  },
  {
    id: 'mouvements', num: '11', title: 'Le journal (tout ce qui se passe)', color: COLORS.gris, icon: 'bi bi-list-check',
    blocks: [{
      steps: [
        'Clique sur « Produits » puis « Mouvement ».',
        'Tu vois toutes les actions faites dans la boutique : ventes, achats, connexions, ajustements.',
        'Utilise les filtres en haut pour chercher par date ou par employé.',
      ],
      image: { src: imgMouvements, alt: 'Journal global des mouvements' },
      resume: 'C’est ton carnet de preuves : tu peux toujours voir qui a fait quoi, et quand.',
    }],
  },
  {
    id: 'documents', num: '12', title: 'Les documents (factures, reçus)', color: COLORS.gris, icon: 'bi bi-file-earmark-text',
    blocks: [{
      steps: [
        'Clique sur « Documents/Rapports » puis « Documents ».',
        'Clique sur « PDF » pour imprimer ou envoyer un document.',
      ],
      image: { src: imgDocuments, alt: 'Liste des documents générés' },
    }],
  },
  {
    id: 'rapports', num: '13', title: 'Les rapports (résumés chiffrés)', color: COLORS.gris, icon: 'bi bi-bar-chart',
    blocks: [{
      steps: [
        'Clique sur « Documents/Rapports » puis « Rapports ».',
        'Choisis le type de rapport et les dates.',
        'Clique sur « Générer », puis « Exporter PDF » pour le garder.',
      ],
      image: { src: imgRapports, alt: 'Génération de rapports' },
    }],
  },
  {
    id: 'pertes', num: '14', title: 'Pertes et casse', color: COLORS.rouge, icon: 'bi bi-exclamation-triangle',
    blocks: [{
      steps: [
        'Clique sur « Produits » puis « Utilisations/pertes ».',
        'Clique sur « Nouvelle Utilisation / Perte ».',
        'Choisis le produit cassé, perdu ou offert, et écris la quantité.',
      ],
      image: { src: imgUtilisationsPertes, alt: 'Suivi des pertes et utilisations internes' },
      resume: 'Sers-toi de cet écran pour un produit cassé, volé, ou donné — pas pour une vente.',
    }],
  },
  {
    id: 'utilisateurs', num: '15', title: 'Le personnel (qui a accès à quoi)', color: COLORS.orange, icon: 'bi bi-people',
    blocks: [{
      steps: [
        'Clique sur « Configuration » puis « Liste utilisateurs ».',
        'Clique sur « + Nouvel utilisateur » pour ajouter un employé.',
        'Choisis son type : Magasinier (le stock), Caissier (les ventes), Gérant ou Administrateur.',
      ],
      image: { src: imgConfigUtilisateurs, alt: 'Liste des utilisateurs et de leurs rôles' },
      resume: 'Chaque employé ne voit que ce dont il a besoin pour son travail.',
    }],
  },
];

// ---------------------------------------------------------------------------
// Rendu à l'écran (React) — mise en page interactive, sommaire cliquable.
// ---------------------------------------------------------------------------

const Shot: React.FC<{ src: string; alt: string }> = ({ src, alt }) => (
  <div style={{ margin: '14px 0 28px' }}>
    <img
      src={src}
      alt={alt}
      style={{
        width: '100%',
        maxWidth: 820,
        display: 'block',
        border: '3px solid #dee2e6',
        borderRadius: 10,
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
      }}
    />
  </div>
);

const Step: React.FC<{ n: number; color: string; children: React.ReactNode }> = ({ n, color, children }) => (
  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', margin: '14px 0' }}>
    <div
      style={{
        flex: '0 0 auto', width: 34, height: 34, borderRadius: '50%', background: color, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 17,
      }}
    >
      {n}
    </div>
    <div style={{ fontSize: 18, lineHeight: 1.5, paddingTop: 3, textAlign: 'justify' }}>{children}</div>
  </div>
);

const SectionTitleView: React.FC<{ id: string; color: string; icon: string; num: string; title: string }> = ({ id, color, icon, num, title }) => (
  <div
    id={id}
    style={{
      display: 'flex', alignItems: 'center', gap: 14, background: color, color: '#fff', borderRadius: 10,
      padding: '14px 20px', margin: '48px 0 6px', scrollMarginTop: 90,
    }}
  >
    <i className={icon} style={{ fontSize: 26 }} />
    <div>
      <div style={{ fontSize: 13, opacity: 0.85, letterSpacing: 1 }}>PARTIE {num}</div>
      <h2 style={{ margin: 0, fontSize: 24, color: '#fff' }}>{title}</h2>
    </div>
  </div>
);

const ResumeView: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ background: '#fff8e1', border: '1px solid #ffe58f', borderLeft: '5px solid #fadb14', borderRadius: 8, padding: '12px 16px', margin: '18px 0', fontSize: 16, textAlign: 'justify' }}>
    <strong>À retenir : </strong>{children}
  </div>
);

const TocItem: React.FC<{ href: string; color: string; icon: string; label: string }> = ({ href, color, icon, label }) => (
  <a
    href={href}
    style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#212529', background: '#fff', border: '1px solid #e9ecef', borderRadius: 10, padding: '10px 14px', fontSize: 15, fontWeight: 600 }}
  >
    <span style={{ width: 30, height: 30, borderRadius: 8, background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
      <i className={icon} style={{ fontSize: 15 }} />
    </span>
    {label}
  </a>
);

const GuideScreen: React.FC = () => (
  <>
    <div style={{ textAlign: 'center', marginBottom: 8 }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Le guide de JÀGO DÁNAYA</h1>
      <p style={{ fontSize: 18, color: '#495057' }}>Pour bien gérer ta boutique, sans aide, étape par étape.</p>
    </div>

    <div style={{ background: '#e7f1ff', borderRadius: 10, padding: '16px 20px', fontSize: 17, lineHeight: 1.6, textAlign: 'justify' }}>
      Chaque partie de ce guide montre une image de l'écran, et te dit quoi faire, dans l'ordre.
      Suis les numéros. Regarde l'image après chaque phrase.
    </div>

    <h3 style={{ marginTop: 28, fontSize: 20 }}>Choisis ce que tu veux apprendre</h3>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 10 }}>
      {GUIDE.map((s) => (
        <TocItem key={s.id} href={`#${s.id}`} color={s.color} icon={s.icon} label={`${s.num}. ${s.title}`} />
      ))}
    </div>

    {GUIDE.map((section) => (
      <React.Fragment key={section.id}>
        <SectionTitleView id={section.id} color={section.color} icon={section.icon} num={section.num} title={section.title} />
        {section.intro && <p style={{ fontSize: 17, textAlign: 'justify' }}>{section.intro}</p>}
        {section.blocks.map((block, bi) => (
          <React.Fragment key={bi}>
            {block.subtitle && <h4 style={{ fontSize: 19, marginTop: 20 }}>{block.subtitle}</h4>}
            {block.steps.map((s, si) => (
              <Step key={si} n={si + 1} color={section.color}>
                <span dangerouslySetInnerHTML={{ __html: s.replace(/« (.+?) »/g, '« <strong>$1</strong> »') }} />
              </Step>
            ))}
            <Shot src={block.image.src} alt={block.image.alt} />
            {block.resume && <ResumeView>{block.resume}</ResumeView>}
          </React.Fragment>
        ))}
      </React.Fragment>
    ))}

    <div style={{ marginTop: 40, background: '#0d1b2a', color: '#fff', borderRadius: 12, padding: '24px 26px' }}>
      <h3 style={{ color: '#fff', fontSize: 21 }}>L'ordre à suivre, dans ta tête</h3>
      <p style={{ fontSize: 19, lineHeight: 1.8, marginBottom: 0 }}>
        Produits → Inventaire → Achats → Ventes → Caisse → Rapports
      </p>
    </div>

    <hr style={{ margin: '30px 0 10px' }} />
    <p className="small text-muted">Ce guide t'aide à travailler seul(e). Dernière mise à jour : 13/07/2026.</p>
  </>
);

// ---------------------------------------------------------------------------
// Rendu imprimable (PDF via impression navigateur, et Word) — mise en page
// simple (tableaux, pas de flex/grid) pour un rendu fidèle, justifié et bien
// paginé aussi bien à l'impression que dans Microsoft Word.
// ---------------------------------------------------------------------------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rich = (s: string) => esc(s).replace(/« (.+?) »/g, '« <b>$1</b> »');

function buildPrintableHtml(resolveImg: (src: string) => string): string {
  const toc = GUIDE.map((s) => `<div>${s.num}. ${esc(s.title)}</div>`).join('\n');

  const sections = GUIDE.map((section) => {
    const intro = section.intro ? `<p class="text">${esc(section.intro)}</p>` : '';
    const blocks = section.blocks.map((block) => {
      const subtitle = block.subtitle ? `<h3 class="sub">${esc(block.subtitle)}</h3>` : '';
      const steps = block.steps.map((s, i) => (
        `<table class="step"><tr>` +
        `<td class="num"><span style="background:${section.color}">${i + 1}</span></td>` +
        `<td class="txt">${rich(s)}</td>` +
        `</tr></table>`
      )).join('\n');
      const img = `<div class="shot"><img src="${resolveImg(block.image.src)}" alt="${esc(block.image.alt)}" /></div>`;
      const resume = block.resume ? `<div class="resume"><b>À retenir :</b> ${esc(block.resume)}</div>` : '';
      return `${subtitle}${steps}${img}${resume}`;
    }).join('\n');
    return `<h2 class="section" style="background:${section.color}">PARTIE ${section.num} — ${esc(section.title)}</h2>${intro}${blocks}`;
  }).join('\n');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Guide - JÀGO DÁNAYA</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; font-size: 13px; line-height: 1.6; margin: 0; }
  h1 { font-size: 27px; color: #0d1b2a; margin: 0 0 4px; text-align: center; }
  .subtitle { text-align: center; color: #495057; font-size: 14px; margin-bottom: 16px; }
  .intro-box { background: #e7f1ff; border-radius: 8px; padding: 14px 18px; font-size: 13.5px; text-align: justify; margin-bottom: 16px; }
  h3.toc-title { font-size: 15px; margin: 18px 0 8px; }
  .toc { columns: 2; -webkit-columns: 2; column-gap: 24px; font-size: 12.5px; margin: 0 0 20px; }
  .toc div { break-inside: avoid; -webkit-column-break-inside: avoid; margin-bottom: 5px; }
  h2.section { color: #fff; padding: 10px 16px; border-radius: 8px; font-size: 16px; margin: 26px 0 10px; page-break-after: avoid; break-after: avoid; }
  h3.sub { font-size: 14.5px; margin: 16px 0 8px; page-break-after: avoid; break-after: avoid; }
  p.text { text-align: justify; font-size: 13px; margin: 6px 0 12px; }
  table.step { border-collapse: collapse; width: 100%; margin: 5px 0; page-break-inside: avoid; break-inside: avoid; }
  table.step td { border: none; padding: 3px 0; vertical-align: top; }
  table.step td.num { width: 26px; min-width: 26px; padding-top: 4px; }
  table.step td.num span { display: inline-block; width: 24px; height: 24px; line-height: 24px; border-radius: 50%; color: #fff; text-align: center; font-weight: bold; font-size: 12px; }
  table.step td.txt { padding-left: 10px; padding-top: 4px; text-align: justify; font-size: 13px; }
  .shot { text-align: center; margin: 10px 0 16px; page-break-inside: avoid; break-inside: avoid; }
  .shot img { width: 160mm; max-width: 100%; border: 1.5px solid #dee2e6; border-radius: 6px; }
  .resume { background: #fff8e1; border-left: 4px solid #fadb14; border-radius: 6px; padding: 9px 14px; font-size: 12.5px; text-align: justify; margin: 8px 0 18px; page-break-inside: avoid; break-inside: avoid; }
  .ordre { background: #0d1b2a; color: #fff; border-radius: 10px; padding: 16px 20px; margin-top: 24px; text-align: center; font-size: 14px; page-break-inside: avoid; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0 8px; }
  .muted { color: #6b7280; font-size: 11px; text-align: center; }
  b { color: #0d1b2a; }
</style>
</head>
<body>
  <h1>Le guide de JÀGO DÁNAYA</h1>
  <div class="subtitle">Pour bien gérer ta boutique, sans aide, étape par étape.</div>
  <div class="intro-box">Chaque partie de ce guide montre une image de l'écran, et te dit quoi faire, dans l'ordre. Suis les numéros. Regarde l'image après chaque phrase.</div>

  <h3 class="toc-title">Sommaire</h3>
  <div class="toc">${toc}</div>

  ${sections}

  <div class="ordre"><b>L'ordre à suivre, dans ta tête</b><br />Produits &rarr; Inventaire &rarr; Achats &rarr; Ventes &rarr; Caisse &rarr; Rapports</div>

  <hr />
  <p class="muted">Ce guide t'aide à travailler seul(e). Dernière mise à jour : 13/07/2026.</p>
</body>
</html>`;
}

function imageToDataUri(src: string): Promise<string> {
  return fetch(src)
    .then((r) => r.blob())
    .then((blob) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }));
}

async function buildImageMap(): Promise<Map<string, string>> {
  const sources = Array.from(new Set(GUIDE.flatMap((s) => s.blocks.map((b) => b.image.src))));
  const map = new Map<string, string>();
  await Promise.all(sources.map(async (src) => {
    try {
      map.set(src, await imageToDataUri(src));
    } catch {
      map.set(src, src);
    }
  }));
  return map;
}

// ---------------------------------------------------------------------------

const Documentation: React.FC = () => {
  const docRef = useRef<HTMLDivElement | null>(null);

  const downloadWord = async () => {
    const map = await buildImageMap();
    const html = buildPrintableHtml((src) => map.get(src) || src);
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Guide-JAGO-DANAYA.doc';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    const html = buildPrintableHtml((src) => src);
    const w = window.open('', '_blank');
    if (!w) return;
    const withPrintScript = html.replace(
      '</body>',
      `<script>
        (function () {
          function doPrint() { try { window.focus(); window.print(); } catch (e) {} }
          function waitImages() {
            var imgs = Array.prototype.slice.call(document.images);
            var remaining = imgs.filter(function (i) { return !i.complete; }).length;
            if (remaining === 0) { setTimeout(doPrint, 150); return; }
            var done = 0;
            function onOne() { done++; if (done >= remaining) setTimeout(doPrint, 150); }
            imgs.forEach(function (img) {
              if (img.complete) return;
              img.addEventListener('load', onOne);
              img.addEventListener('error', onOne);
            });
            setTimeout(doPrint, 4000);
          }
          window.addEventListener('load', waitImages);
        })();
      </script></body>`
    );
    w.document.open();
    w.document.write(withPrintScript);
    w.document.close();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dl = (params.get('download') || '').toLowerCase();
    if (dl !== 'pdf' && dl !== 'word') return;
    const t = window.setTimeout(async () => {
      try {
        if (dl === 'pdf') await downloadPdf();
        if (dl === 'word') await downloadWord();
      } finally {
        try {
          const next = window.location.pathname;
          window.history.replaceState({}, document.title, next);
        } catch { /* ignore */ }
      }
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-0">GUIDE D'UTILISATION — JÀGO DÁNAYA</h4>
          <small className="text-muted">Un guide simple, en images, pour utiliser l'application seul(e)</small>
        </div>
        <div className="btn-group">
          <button className="btn btn-outline-primary" onClick={downloadPdf} aria-label="Télécharger en PDF">Télécharger (PDF)</button>
          <button className="btn btn-outline-secondary" onClick={downloadWord} aria-label="Télécharger en Word">Télécharger (Word)</button>
        </div>
      </div>

      <div ref={docRef} className="documentation-content card p-4" style={{ maxWidth: 900 }}>
        <GuideScreen />
      </div>
    </div>
  );
};

export default Documentation;
