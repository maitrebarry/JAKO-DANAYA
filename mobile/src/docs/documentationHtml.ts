export const DOCUMENTATION_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Guide - JÀGO DÁNAYA</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; padding: 20px; font-size: 15px; line-height: 1.65; margin: 0; }
    h1 { color: #0d1b2a; font-size: 24px; margin: 0 0 4px 0; text-align: center; }
    .subtitle { text-align: center; color: #495057; font-size: 13px; margin: 0 0 16px; }
    h2 { color: #ffffff; background: #0d6efd; padding: 10px 14px; border-radius: 8px; font-size: 16px; margin: 26px 0 10px 0; page-break-after: avoid; }
    .intro { background: #e7f1ff; border-radius: 8px; padding: 14px 16px; font-size: 14px; text-align: justify; margin-bottom: 14px; }
    table.step { border-collapse: collapse; width: 100%; margin: 8px 0; page-break-inside: avoid; }
    table.step td { border: none; padding: 3px 0; vertical-align: top; }
    table.step td.num { width: 26px; min-width: 26px; padding-top: 4px; }
    table.step td.num span { display: inline-block; width: 24px; height: 24px; line-height: 24px; border-radius: 50%; background: #0d6efd; color: #fff; text-align: center; font-weight: bold; font-size: 12.5px; }
    table.step td.txt { padding-left: 10px; padding-top: 4px; text-align: justify; font-size: 14px; }
    .retenir { background: #fff8e1; border-left: 4px solid #fadb14; border-radius: 6px; padding: 10px 14px; margin: 10px 0 16px; font-size: 13.5px; text-align: justify; page-break-inside: avoid; }
    .ordre { background: #0d1b2a; color: #fff; border-radius: 10px; padding: 16px 18px; margin-top: 24px; font-size: 15px; text-align: center; page-break-inside: avoid; }
    hr { margin: 20px 0; border: none; border-top: 1px solid #e5e7eb; }
    .muted { color: #6b7280; font-size: 12px; text-align: center; }
    b { color: #0d1b2a; }
  </style>
</head>
<body>
  <h1>Le guide de JÀGO DÁNAYA</h1>
  <p class="subtitle">Pour bien gérer ta boutique, sans aide, étape par étape.</p>

  <div class="intro">Ce guide te dit quoi faire, dans l'ordre. Suis les numéros, un par un.</div>

  <h2>1. Se connecter</h2>
  <table class="step"><tr><td class="num"><span>1</span></td><td class="txt">Ouvre l'application.</td></tr></table>
  <table class="step"><tr><td class="num"><span>2</span></td><td class="txt">Tape ton email.</td></tr></table>
  <table class="step"><tr><td class="num"><span>3</span></td><td class="txt">Tape ton mot de passe.</td></tr></table>
  <table class="step"><tr><td class="num"><span>4</span></td><td class="txt">Appuie sur le bouton « Connexion ».</td></tr></table>
  <div class="retenir"><b>À retenir :</b> Mot de passe oublié ? Appuie sur « Mot de passe oublié ? ».</div>

  <h2>2. Le tableau de bord</h2>
  <table class="step"><tr><td class="num"><span>1</span></td><td class="txt">C'est le premier écran après la connexion.</td></tr></table>
  <table class="step"><tr><td class="num"><span>2</span></td><td class="txt">Les carrés de couleur montrent les chiffres importants du jour.</td></tr></table>

  <h2>3. Configuration de départ (une seule fois)</h2>
  <table class="step"><tr><td class="num"><span>1</span></td><td class="txt">Va dans « Configuration », puis « Unité ». Ajoute au moins une unité (carton, sac, paquet).</td></tr></table>
  <table class="step"><tr><td class="num"><span>2</span></td><td class="txt">Va dans « Configuration », puis « Marges ». Choisis combien tu ajoutes au prix d'achat.</td></tr></table>
  <div class="retenir"><b>À retenir :</b> Une fois réglé, l'application calcule toute seule le prix de vente.</div>

  <h2>4. Les produits</h2>
  <table class="step"><tr><td class="num"><span>1</span></td><td class="txt">Va dans « Produits » pour voir la liste de tes produits.</td></tr></table>
  <table class="step"><tr><td class="num"><span>2</span></td><td class="txt">Appuie sur « Ajouter un article » pour créer un nouveau produit.</td></tr></table>
  <table class="step"><tr><td class="num"><span>3</span></td><td class="txt">Écris le nom et le prix d'achat. Le prix de vente se remplit tout seul.</td></tr></table>
  <div class="retenir"><b>À retenir :</b> Un nouveau produit démarre à 0 en stock. Fais l'inventaire pour dire combien tu en as vraiment.</div>

  <h2>5. L'inventaire (compter ce que tu as)</h2>
  <table class="step"><tr><td class="num"><span>1</span></td><td class="txt">Va dans « Inventaire », puis « Nouveau Inventaire ».</td></tr></table>
  <table class="step"><tr><td class="num"><span>2</span></td><td class="txt">Compte ce que tu as vraiment, produit par produit.</td></tr></table>
  <table class="step"><tr><td class="num"><span>3</span></td><td class="txt">Écris la quantité, puis valide.</td></tr></table>
  <div class="retenir"><b>À retenir :</b> Fais toujours l'inventaire avant tes premières ventes.</div>

  <h2>6. Les achats chez tes fournisseurs</h2>
  <table class="step"><tr><td class="num"><span>1</span></td><td class="txt">Va dans « Fournisseur » pour voir ou ajouter un fournisseur.</td></tr></table>
  <table class="step"><tr><td class="num"><span>2</span></td><td class="txt">Va dans « Achats », puis « Commande » pour commander des produits.</td></tr></table>
  <table class="step"><tr><td class="num"><span>3</span></td><td class="txt">Quand la marchandise arrive, enregistre la réception : le stock augmente tout seul.</td></tr></table>

  <h2>7. Déplacer du stock entre magasins</h2>
  <table class="step"><tr><td class="num"><span>1</span></td><td class="txt">Va dans « Produits », puis « Transfert ».</td></tr></table>
  <table class="step"><tr><td class="num"><span>2</span></td><td class="txt">Choisis d'où vient le stock et où il va, puis la quantité.</td></tr></table>
  <table class="step"><tr><td class="num"><span>3</span></td><td class="txt">Appuie sur « Transférer ».</td></tr></table>

  <h2>8. Vendre</h2>
  <table class="step"><tr><td class="num"><span>1</span></td><td class="txt">Pour une vente rapide : va dans « Vente en Espèce ».</td></tr></table>
  <table class="step"><tr><td class="num"><span>2</span></td><td class="txt">Ajoute les produits achetés par le client.</td></tr></table>
  <table class="step"><tr><td class="num"><span>3</span></td><td class="txt">Écris l'argent reçu, puis « Enregistrer la vente ». La monnaie à rendre s'affiche toute seule.</td></tr></table>
  <div class="retenir"><b>À retenir :</b> Pour une vente à crédit ou en gros, utilise « Ventes » puis « Ajouter Vente ».</div>

  <h2>9. La caisse (l'argent de la journée)</h2>
  <table class="step"><tr><td class="num"><span>1</span></td><td class="txt">Le matin : ouvre la caisse dans « Caisse » et écris l'argent de départ.</td></tr></table>
  <table class="step"><tr><td class="num"><span>2</span></td><td class="txt">Le soir : ferme la caisse.</td></tr></table>
  <div class="retenir"><b>À retenir :</b> Sans caisse ouverte, tu ne peux pas vendre.</div>

  <h2>10. Les dépenses</h2>
  <table class="step"><tr><td class="num"><span>1</span></td><td class="txt">Va dans « Dépenses ». Écris pourquoi et combien tu dépenses.</td></tr></table>
  <table class="step"><tr><td class="num"><span>2</span></td><td class="txt">Un responsable doit valider avant que l'argent sorte de la caisse.</td></tr></table>

  <h2>11. Le journal (tout ce qui se passe)</h2>
  <table class="step"><tr><td class="num"><span>1</span></td><td class="txt">Va dans « Produits », puis « Mouvement » pour voir toutes les actions faites dans la boutique.</td></tr></table>

  <h2>12. Documents et rapports</h2>
  <table class="step"><tr><td class="num"><span>1</span></td><td class="txt">Va dans « Documents/Rapports » pour retrouver tes factures et reçus.</td></tr></table>
  <table class="step"><tr><td class="num"><span>2</span></td><td class="txt">Choisis un type de rapport et des dates, puis « Générer » et « Exporter PDF ».</td></tr></table>

  <h2>13. Pertes et casse</h2>
  <table class="step"><tr><td class="num"><span>1</span></td><td class="txt">Va dans « Produits », puis « Utilisations/pertes » pour un produit cassé, perdu ou offert.</td></tr></table>

  <h2>14. Le personnel</h2>
  <table class="step"><tr><td class="num"><span>1</span></td><td class="txt">Va dans « Configuration », puis « Liste utilisateurs » pour ajouter un employé.</td></tr></table>
  <table class="step"><tr><td class="num"><span>2</span></td><td class="txt">Choisis son rôle : Magasinier, Caissier, Gérant ou Administrateur.</td></tr></table>

  <div class="ordre">
    <b>L'ordre à suivre, dans ta tête :</b><br />
    Produits &rarr; Inventaire &rarr; Achats &rarr; Ventes &rarr; Caisse &rarr; Rapports
  </div>

  <hr />
  <p class="muted">Pour voir ce guide avec des images de l'application, ouvre la documentation web depuis l'écran précédent. Dernière mise à jour : 13/07/2026.</p>
</body>
</html>`;
