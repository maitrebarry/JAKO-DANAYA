# Scénario — CMP (Coût Moyen Pondéré) & Abonnement « acheté » (licence à vie)

> Document de cadrage à valider **avant** implémentation.
> Rédigé le 2026-08-09. Deux chantiers indépendants décrits ci-dessous.

---

## Partie 1 — CMP : mettre et expliquer la formule

### 1.1 Ce qui existe déjà (rappel)

Le CMP est **déjà calculé** au backend à chaque réception d'achat :

- Fichier : `backend/.../controller/ReceptionController.java` (méthode `updateStockCostAndPrices`).
- Le CMP est stocké dans **`stock.cost_average`** et son arrondi est recopié dans **`produit.prix_achat`**.
- Le dernier prix fournisseur est stocké dans **`stock.last_purchase_price`**.
- Les prix de vente `prix_en_gros` / `prix_detail` sont ensuite recalculés via `MargeCalculator.apply(config, produit)` :
  - mode **AUTOMATIQUE** → prix de vente = prix_achat + marge configurée ;
  - mode **MANUEL** → les prix saisis à la main ne sont **pas** écrasés.

**Le manque** : la réponse de réception renvoie déjà `ancienCMP`, `quantiteRecue`, `prixFournisseur`, `nouveauCMP` (voir `ReceptionDTO.LigneReceptionResultDTO`), mais **aucun écran ne les affiche ni n'explique le calcul**. Le commerçant voit son `prix_achat` changer sans comprendre pourquoi.

### 1.2 La formule (à afficher/expliquer)

Le CMP est recalculé à chaque entrée en stock (réception d'achat) :

```
                (CMP_ancien × Stock_ancien) + (Prix_fournisseur × Quantité_reçue)
CMP_nouveau  =  ─────────────────────────────────────────────────────────────────
                            Stock_ancien + Quantité_reçue
```

- `CMP_ancien` = `stock.cost_average` avant réception
- `Stock_ancien` = `stock.quantite_disponible` avant réception (en unités de base)
- `Prix_fournisseur` = prix d'achat unitaire de cette réception (`ligneCommande.newPrice`)
- `Quantité_reçue` = quantité réceptionnée (en unités de base)

Le résultat est arrondi (HALF_UP) pour renseigner `produit.prix_achat`.

**Exemple concret :**
- Stock actuel : 10 unités à un CMP de 1 000 F → valeur = 10 000 F
- Réception : 5 unités à 1 300 F chez le fournisseur → valeur = 6 500 F
- Nouveau CMP = (10 000 + 6 500) / (10 + 5) = 16 500 / 15 = **1 100 F**

**Garde-fous déjà en place :** le nouveau CMP doit toujours être compris entre l'ancien CMP et le prix fournisseur ; sinon la réception est rejetée (`CMP incohérent calculé`).

### 1.3 Scénarios utilisateur

**S1 — Voir le détail du CMP après une réception**
> En tant que propriétaire/gestionnaire, quand je valide une réception d'achat, je veux voir pour chaque produit : ancien CMP, quantité reçue × prix fournisseur, et **nouveau CMP**, afin de comprendre pourquoi mon prix d'achat a changé.

- Affichage : récapitulatif de fin de réception (web `Reception.tsx` / `DetailReception.tsx`, mobile `AchatReceptionScreen.tsx`), une ligne par produit avec ancien → nouveau CMP.

**S2 — Comprendre la formule (aide)**
> En tant qu'utilisateur, je veux un petit « ? » / encart d'aide qui affiche la formule et un exemple, afin de faire confiance au calcul.

- Affichage : icône info à côté du prix d'achat / du récap CMP, ouvrant un encart avec la formule de la §1.2.

**S3 — Première réception d'un produit (stock initial nul)**
> Quand le stock est à 0, le nouveau CMP = prix fournisseur (pas de moyenne à faire). L'aide doit le préciser.

### 1.4 Critères d'acceptation (CMP)

- [ ] Le récap de réception affiche par ligne : `ancien CMP`, `quantité reçue`, `prix fournisseur`, `nouveau CMP`.
- [ ] Un encart/aide affiche la formule et un exemple chiffré.
- [ ] Cas stock initial = 0 → CMP = prix fournisseur, sans division par zéro.
- [ ] Aucun changement du calcul backend (déjà correct) — **affichage uniquement**.
- [ ] Cohérent web + mobile.

### 1.5 Points d'attention

- Unités : le calcul se fait en **unités de base**, pas en conditionnements — l'affichage doit être clair (par pièce vs par carton).
- Le mode MANUEL des prix de vente ne doit pas être remis en cause par cet affichage.

---

## Partie 2 — Abonnement « acheté » (licence définitive / à vie)

### 2.1 Contexte & besoin

Certains clients veulent **acheter l'application une fois pour toutes** plutôt que de payer un abonnement récurrent. Pour eux : **pas d'échéance, pas de blocage, pas de rappel de renouvellement**.

### 2.2 Ce qui existe déjà (rappel)

- Tables : `abonnement_plan` (code, libelle, duree_mois, prix, devise, actif), `abonnement_boutique` (statut, date_debut, **date_fin**, grace_end_at, plan_id), `abonnement_paiement`.
- **Blocage d'accès** (`SubscriptionAccessFilter`) : une boutique est bloquée (HTTP 402) si
  - `statut ∈ {EXPIRED, PAST_DUE, CANCELED}`, **ou**
  - `date_fin` dépassée (et grâce dépassée).
- Donc une boutique avec **`statut = ACTIVE` et `date_fin = NULL`** n'est **jamais** bloquée. ✅ C'est le levier clé.
- L'activation d'un plan (`SubscriptionPaymentServiceImpl.simulateSuccess`) crée aujourd'hui `date_fin = date_debut + duree_mois`. **À adapter** pour le plan « acheté ».

### 2.3 Principe de la solution

Introduire un **plan de type « ACHAT / À VIE »** qui, une fois activé pour une boutique, pose `date_fin = NULL` (accès illimité) et un statut non bloquant.

### 2.4 Scénarios utilisateur

**S4 — Attribuer une licence achetée à une boutique**
> En tant que SuperAdmin, je peux marquer une boutique comme « licence achetée » (avec le montant payé + preuve), afin qu'elle ne soit plus jamais soumise à l'abonnement.

- Effet : `abonnement_boutique` avec statut non bloquant + `date_fin = NULL`.

**S5 — Le client n'est jamais bloqué**
> En tant que propriétaire d'une boutique « achetée », je n'ai aucun blocage 402 ni modale de renouvellement, quelle que soit la date.

**S6 — Statut visible côté client**
> En tant que propriétaire, dans l'écran abonnement je vois « Application achetée — accès illimité » (badge), sans bouton « Renouveler » ni compte à rebours.

**S7 — Historique**
> Le paiement d'achat apparaît dans l'historique comme un achat unique (pas récurrent).

### 2.5 Décisions à valider (voir aussi la section « Questions ouvertes »)

1. **Nom / code du plan** : `PERPETUEL` ? `ACHAT` ? `LICENCE_ACHAT` ? (proposition : `ACHAT`, libellé « Licence achetée (à vie) »).
2. **Représentation du « jamais expiré »** :
   - **(recommandé)** statut = `ACTIVE` + `date_fin = NULL` → aucun changement du filtre nécessaire ;
   - ou nouveau statut dédié `PERPETUAL`/`OWNED` (plus explicite mais impose d'ajuster filtre + `/current`).
3. **Qui active** : réservé au **SuperAdmin** (recommandé, car c'est une vente hors-app) ou aussi achetable en self-service comme les autres plans ?
4. **Modèle de données `duree_mois`** : le plan achat aura `duree_mois = 0/NULL` ⇒ `simulateSuccess` doit alors poser `date_fin = NULL` au lieu de `date_debut + duree_mois`.

### 2.6 Impacts techniques (pour l'implémentation, après validation)

- **Migration SQL** : insérer le plan `ACHAT` (`abonnement_plan`) ; autoriser `duree_mois` nul/0 si besoin.
- **`SubscriptionPaymentServiceImpl`** : si plan « achat » → `date_fin = NULL` (ne pas empiler `plusMonths`).
- **`SubscriptionController.current`** : renvoyer un état `perpetual: true`, `daysRemaining: null`, `shouldShowModal: false`, message « Application achetée ».
- **`SubscriptionAccessFilter`** : rien à changer si on garde `ACTIVE` + `date_fin = NULL` (à revérifier).
- **`AdminController`** : action SuperAdmin « attribuer licence achetée » (option S4).
- **Front/mobile** : `SubscriptionScreen` / `SubscriptionRenewScreen` / `Configuration.tsx` → badge « acheté », masquer renouvellement + compte à rebours.

### 2.7 Critères d'acceptation (Abonnement acheté)

- [ ] Une boutique « achetée » n'est jamais bloquée (402), même avec une date passée.
- [ ] Aucune modale/notification de renouvellement pour ces boutiques.
- [ ] `/api/subscription/current` indique clairement l'état « acheté / illimité ».
- [ ] Le SuperAdmin peut attribuer et retirer ce statut.
- [ ] L'historique de paiement montre un achat unique.

### 2.8 Points d'attention / cas limites

- Boutique déjà abonnée qui **achète** ensuite → passer en « acheté » (date_fin = NULL) sans perdre l'historique.
- Retrait de la licence (remboursement/litige) → repasser en abonnement normal expiré ?
- `SubscriptionAccessFilter` : bien vérifier que `date_fin = NULL` + statut non bloquant = accès garanti (cas legacy déjà géré).

---

## Décisions validées (2026-08-09)

| # | Sujet | Décision |
|---|-------|----------|
| Q1 | Où « mettre et expliquer » le CMP | **Récap réception (ancien → nouveau CMP par produit) + encart d'aide « ? » avec la formule** |
| Q2 | Code/libellé du plan acheté | **Code `ACHAT` — libellé « Licence achetée (à vie) »** |
| Q3 | Activation de la licence achetée | **SuperAdmin uniquement** (vente hors-app, montant + preuve) |
| Q4 | Représentation « jamais expiré » | **`statut = ACTIVE` + `date_fin = NULL`** (impact minimal, filtre inchangé) |

Conséquences confirmées :
- CMP = chantier **affichage** (web + mobile), aucun changement du calcul backend.
- Plan `ACHAT` avec `duree_mois = 0/NULL` ⇒ l'activation pose `date_fin = NULL`.
- Pas de flux self-service pour l'achat : une action **SuperAdmin** attribue/retire la licence.

---

## Prochaine étape

Scénario validé. Implémentation à lancer sur accord :
1. **CMP (affichage)** : récap réception ancien→nouveau CMP + encart formule (web `Reception.tsx`/`DetailReception.tsx`, mobile `AchatReceptionScreen.tsx`).
2. **Abonnement acheté** : migration plan `ACHAT` → `SubscriptionPaymentServiceImpl` (date_fin NULL) → `SubscriptionController.current` (état illimité) → action SuperAdmin (`AdminController`) → UI (badge « acheté », masquer renouvellement).
