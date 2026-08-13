# Scénario — Option « Revendeur » (prix pour le reçu)

> Document de cadrage à valider **avant** implémentation.

## 1. Objectif

Ajouter une **option « Revendeur » activable par boutique**. Quand elle est activée, lors d'une **vente en espèce** ou d'une **commande client**, on peut saisir — **par ligne de produit** — un **« prix revendeur »** : le prix auquel le revendeur a revendu le produit à son propre client.

Règles absolues :
- Ce prix **n'affecte JAMAIS** les prix du produit (`prix_detail`, `prix_en_gros`, `prix_achat`) ni les prix de vente réels.
- Il **n'affecte JAMAIS** la comptabilité interne : caisse, montant réellement encaissé, stock, marges, rapports → tout reste basé sur le **prix réel**.
- Il sert **uniquement à l'affichage sur le reçu** remis au client du revendeur.
- Le système garde **une trace des deux** : le **prix réel** (déjà stocké dans `newPrice`) **et** le **prix revendeur**.

## 2. Ce qui existe (rappel)

- `ligne_vente.new_price_vente` (`LigneVente.newPrice`) = prix réel unitaire de la ligne (vente espèce).
- `ligne_commande_client.new_price_cmndClient` (`LigneCommandeClient.newPrice`) = prix réel unitaire (commande client).
- Création : `POST /api/ventes/cash` (`createVenteCash`) et `POST /api/ventes/full` (`createVenteFull`) posent `setNewPrice(pl.prix)` par ligne.
- Reçus PDF : `PdfService.writeVentePdf(venteId)` et `writeCommandeClientPdf(commandeId)` — le prix unitaire affiché = `newPrice`.
- Aucune « option » au niveau boutique aujourd'hui (seule `ConfigurationMarge` est liée à la boutique).

## 3. Modèle de données (nouvelles colonnes, nullable, non destructif)

1. `boutique` → `option_revendeur BOOLEAN NOT NULL DEFAULT FALSE`.
2. `ligne_vente` → `prix_revendeur INTEGER NULL`.
3. `ligne_commande_client` → `prix_revendeur INTEGER NULL`.

Migrations idempotentes + auto-appliquées au démarrage (même mécanisme que les autres colonnes JAKO). Aucune donnée existante modifiée.

## 4. Backend

- **Modèles** : `Boutique.optionRevendeur` ; `LigneVente.prixRevendeur` ; `LigneCommandeClient.prixRevendeur`.
- **DTOs de vente** (`VenteCashRequest` / `VenteFullRequest`, item de ligne) : ajouter `prixRevendeur` (optionnel).
- **`createVenteCash` / `createVenteFull`** :
  - `setNewPrice(pl.prix)` **inchangé** (prix réel).
  - **Si** `boutique.optionRevendeur == true` **et** `pl.prixRevendeur` fourni → `setPrixRevendeur(pl.prixRevendeur)`. Sinon → laissé `NULL` (ignoré).
  - Totaux, `montant_total`, `net_a_payer`, caisse, stock, mouvements → **calculés sur `newPrice` uniquement** (aucun changement).
- **Exposition de l'option** : renvoyer `optionRevendeur` dans les endpoints boutique (lecture) pour que le front sache afficher ou non le champ ; ajouter sa mise à jour dans l'édition de boutique.
- **Reçus** (`writeVentePdf`, `writeCommandeClientPdf`) : si la ligne a un `prixRevendeur` (option active) → utiliser `prixRevendeur` comme prix unitaire **affiché** et recalculer le **total affiché** à partir des prix revendeur ; sinon comportement actuel (`newPrice`). **Aucune écriture** en base côté prix réels.

## 5. Frontend (web) + Mobile

- **Configuration → Boutique** : case à cocher **« Option revendeur »** (édition boutique).
- **Écran Vente espèce** et **Commande client** : si `boutique.optionRevendeur`, afficher un champ **optionnel** par ligne « **Prix revendeur (reçu)** », à côté du prix réel. Envoyer `prixRevendeur` dans le payload.
- Le total affiché au **caissier** reste le **total réel** (ce qui est encaissé). Le prix revendeur n'apparaît que sur le **reçu**.

## 6. Garanties (invariants)

| Élément | Basé sur |
|---|---|
| Caisse / montant encaissé / net à payer | **prix réel** (`newPrice`) |
| Stock, mouvements | prix réel |
| Marges, rapports, dashboard | prix réel |
| Prix du produit (`prix_detail/gros/achat`) | **jamais modifiés** |
| Reçu (client du revendeur) | **prix revendeur** (si saisi) |
| Trace en base | **les deux** (`newPrice` + `prix_revendeur`) |

## 7. Décisions validées

1. **Total du reçu** : **total en prix revendeur** (lignes + total du reçu calculés sur les prix revendeur saisis).
2. **Caisse + rapports** : 100 % sur le **prix réel** (`newPrice`) — inchangé.
3. **Contrainte prix revendeur** : **libre** (aucune contrainte de valeur).
4. **Activation de l'option** : **SuperAdmin uniquement** (Configuration → Boutique).
5. **Flux couverts** : **vente espèce + commande client** (pas d'autre flux pour l'instant).
6. **Rapport « marge revendeur »** : **non** au début (extension possible plus tard).

## 8. Prochaine étape

Plan validé. Implémentation dans l'ordre : migrations (3 colonnes) → backend (modèles/DTO/`createVenteCash`+`createVenteFull`/exposition option/PDF reçus) → UI web (config boutique + écrans vente espèce & commande client) → mobile.
