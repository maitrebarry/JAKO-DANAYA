# Abonnements (déploiement progressif, sans casse)

Objectif: ajouter les abonnements **sans impacter** les fonctionnalités déjà en production sur Render.

## Phase 1 (sans impact runtime)

- Ajouter uniquement la base de données (tables `abonnement_*`) via script SQL.
- Ne brancher aucun blocage d'accès dans le backend existant.
- Les flux actuels (ventes, achats, PDF, dashboard) restent inchangés.

Script: [backend/db/migration/20260214_add_abonnement_tables.sql](../backend/db/migration/20260214_add_abonnement_tables.sql)

## Phase 2 (superadmin uniquement)

- Ajouter des endpoints superadmin pour:
  - lister/modifier les plans
  - activer/suspendre un abonnement boutique
  - consulter l'état d'une boutique
- Aucun blocage côté utilisateurs finaux à cette phase.

## Phase 3 (activation contrôlée)

- Ajouter un garde global d'abonnement **sous feature flag**:
  - ex: `app.subscription.enforcement-enabled=false` par défaut
- Autoriser toujours:
  - `/api/auth/**`
  - endpoints superadmin abonnement
  - route de paiement abonnement
- Bloquer progressivement uniquement quand le flag passe à `true`.

## Phase 4 (production)

1. Appliquer SQL en prod.
2. Déployer backend avec endpoints superadmin (sans enforcement).
3. Tester sur une boutique pilote.
4. Activer le flag enforcement en prod.

## Extension PROD sur Render (checklist exécutable)

### 1) Base de données prod

- Exécuter les migrations abonnement en prod (dans cet ordre):
  - [backend/db/migration/20260214_add_abonnement_tables.sql](../backend/db/migration/20260214_add_abonnement_tables.sql)
  - [backend/db/migration/20260215_add_plan_code_to_abonnement_paiement.sql](../backend/db/migration/20260215_add_plan_code_to_abonnement_paiement.sql)
- Vérifier:
  - tables `abonnement_plan`, `abonnement_boutique`, `abonnement_paiement` présentes
  - colonnes `mode_paiement`, `preuve_url`, `review_*` présentes
  - index créés

### 2) Variables d’environnement Render (backend)

- `SPRING_PROFILES_ACTIVE=prod`
- `app.subscription.enforcement-enabled=true` (ou `false` pendant la phase pilote)
- `app.upload.user-photo-dir` et dossier uploads persistant
- Variables DB prod correctes (`SPRING_DATASOURCE_*`)

> Recommandé: garder `enforcement-enabled=false` sur le premier déploiement, valider la lecture/écriture abonnement, puis passer à `true`.

### 3) Déploiement backend Render

1. Déployer backend avec endpoints abonnement + superadmin.
2. Vérifier santé API:
   - login OK
   - superadmin voit plans + paiements
   - owner peut soumettre preuve manuelle
3. Vérifier que les preuves uploadées sont accessibles publiquement via `/uploads/...`.

### 4) Rollout contrôlé

- Pilote sur 1 boutique.
- Vérifier cycle complet:
  1) boutique expirée voit bannière
  2) soumet preuve
  3) superadmin valide
  4) accès restauré
- Ensuite généraliser.

### 5) Rollback rapide

- Si incident prod:
  - repasser `app.subscription.enforcement-enabled=false`
  - redéployer (ou restart service) sans rollback DB.

## Extension Mobile (smartphones)

### Objectif UX mobile

- Reprendre exactement le même workflow que web:
  - bannière abonnement expiré en haut
  - bouton « se réabonner »
  - choix formule
  - montant dynamique
  - preuve photo via caméra

### API mobile à consommer

- `GET /api/subscription/current`
- `GET /api/subscription/plans`
- `POST /api/subscription/payments/manual-submit` (multipart)
- `GET /api/subscription/payments` (historique owner)

### Détails techniques mobile (Expo/React Native)

- Capturer la preuve avec caméra:
  - `expo-image-picker` (caméra) ou `expo-camera`
- Upload multipart:
  - `FormData` avec champs: `planCode`, `modePaiement`, `transactionRef`, `ownerNote`, `receipt`
- Afficher bannière persistante tant que `blocked=true`.
- Bloquer les écrans métier non autorisés si abonnement expiré, mais laisser accès à l’écran réabonnement.

### Variables mobile

- `EXPO_PUBLIC_API_BASE_URL_LOCAL` pour local LAN
- `EXPO_PUBLIC_API_BASE_URL_PROD` pour build prod

### Plan de validation mobile

1. Connexion owner expiré => bannière visible.
2. Ouverture caméra => prise photo => upload OK.
3. Superadmin valide sur web.
4. Mobile récupère nouvel état (`blocked=false`) et débloque les fonctionnalités.

## Critères de fin (Done)

- PROD Render: workflow complet validé sur boutique pilote.
- Mobile: workflow complet validé (capture caméra + upload + validation).
- Monitoring: logs d’actions superadmin et erreurs upload vérifiés.
- Procédure rollback testée (feature flag).

## Règles métier recommandées

- Statuts: `ACTIVE`, `EXPIRED`, `PAST_DUE`, `CANCELED`, `TRIAL`
- Plans: `MENSUEL`, `TRIMESTRIEL`, `SEMESTRIEL`, `ANNUEL`
- Grace period configurable (3-7 jours)
- Journal d'audit pour actions superadmin

## Pourquoi cette approche est sûre

- Pas de changement sur les endpoints existants au début.
- Activation par étapes.
- Rollback simple: désactiver le flag enforcement.
