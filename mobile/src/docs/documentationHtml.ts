export const DOCUMENTATION_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Documentation - JÀGO DÁNAYA</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; padding: 18px; }
    h1, h2, h3, h4 { color: #0d6efd; margin: 0 0 10px 0; }
    h1 { font-size: 22px; }
    h2 { font-size: 18px; }
    h3 { font-size: 16px; margin-top: 18px; }
    h4 { font-size: 14px; margin-top: 10px; }
    p, li { font-size: 12px; line-height: 1.55; }
    ul { padding-left: 18px; }
    hr { margin: 18px 0; border: none; border-top: 1px solid #e5e7eb; }
    .muted { color: #6b7280; }
  </style>
</head>
<body>
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
    <li>aucun mouvement de stock ni financier n’est créé.</li>
  </ul>

  <h4>3.2 Importation des produits</h4>
  <p>L’importation permet de créer plusieurs produits à la fois. Après l’importation, l’inventaire est obligatoire.</p>

  <h3>ÉTAPE 4 — INVENTAIRE INITIAL (OBLIGATOIRE)</h3>
  <p>L’inventaire permet d’introduire la réalité physique du stock dans le système.</p>

  <h3>ÉTAPE 5 — ACHATS ET RÉCEPTIONS</h3>
  <p>À la réception : conversion automatique en unités, recalcul du CMP, mise à jour du stock, création des mouvements d’entrée.</p>

  <h3>ÉTAPE 6 — TRANSFERTS (SI MAGASINS EXISTANTS)</h3>
  <p>Le transfert permet de déplacer le stock : du magasin vers la boutique, ou entre magasins.</p>

  <h3>ÉTAPE 7 — VENTES</h3>
  <p>Le système décrémente toujours le stock en unités, conserve la logique du conditionnement pour l’affichage.</p>

  <h3>ÉTAPE 8 — CAISSE</h3>
  <p>La caisse gère uniquement l’argent : entrées, sorties, soldes.</p>

  <h3>ÉTAPE 9 — MOUVEMENTS ET JOURNAL</h3>
  <p>La table des mouvements trace : ventes, achats, réceptions, transferts, inventaires, ajustements, actions utilisateur.</p>

  <h3>CONCLUSION</h3>
  <p>La logique de JÀGO DÁNAYA repose sur un ordre strict :</p>
  <p><em>Produits → Inventaire → Achats → Stock → Ventes → Caisse → Rapports</em></p>

  <hr />
  <p class="muted">Ce document est fourni à titre d'aide utilisateur. Dernière mise à jour : 08/02/2026.</p>
</body>
</html>`;
