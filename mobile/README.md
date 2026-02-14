# JÀGO DÁNAYA — Mobile

Base mobile du projet (React Native + Expo). Cette étape fournit l’architecture et la navigation, sans logique métier.

## Stack
- Expo (React Native)
- React Navigation (stack + tabs)

## Structure
```
mobile/
  src/
    assets/
    components/
    navigation/
    screens/
    services/
    store/
    utils/
  App.tsx
  package.json
  .env.example
```

## Démarrer (Expo Go — mode de test obligatoire)
1) Installer les dépendances
2) Lancer l’app (Android prioritaire)
3) Scanner le QR code avec Expo Go (Android)

Commandes recommandées :
- Local (backend local, pour tester progressivement) : `npm run start:local`
- Prod (backend Render, pour valider avant release) : `npm run start:prod`

NB: si tu testes sur un vrai téléphone, l’URL locale doit être l’IP LAN de ton PC (pas `localhost`).

## Configuration
L’app mobile utilise Expo public env vars (disponibles en dev et injectées au build).

Copie `.env.example` en `.env` puis adapte :
- `EXPO_PUBLIC_ENV=local|prod`
- `EXPO_PUBLIC_API_BASE_URL_LOCAL` (ex: `http://192.168.x.x:8085`)
- `EXPO_PUBLIC_API_BASE_URL_PROD` (ex: `https://jako-danaya.onrender.com`)
- `EXPO_PUBLIC_FRONTEND_BASE_URL_*` (utilisé pour les redirects OAuth)

Astuce : garde les 2 URLs (local + prod) dans `.env` et change seulement `EXPO_PUBLIC_ENV`.

## Déploiement Play Store + App Store (EAS)
Le projet est prêt pour des builds “store” via EAS avec le profil `production` (voir `eas.json`).

### Prérequis
- Compte Expo + EAS CLI
- Google Play Console (Android)
- Apple Developer Program (iOS)

### Initialisation EAS (une seule fois)
Dans `mobile/` :
- `npm i -g eas-cli`
- `eas login`
- `eas init`

### Build Android (AAB)
- `eas build --platform android --profile production`

### Build iOS (App Store)
- `eas build --platform ios --profile production`

### Soumission (optionnel, via EAS)
- Android : `eas submit --platform android --profile production`
- iOS : `eas submit --platform ios --profile production`

NB: le profil `production` force `EXPO_PUBLIC_ENV=prod` et injecte les variables `EXPO_PUBLIC_*_PROD` pour éviter toute build store qui pointe vers l’API locale.

## Écrans (placeholders)
- Login (classique + Google)
- Sélection boutique
- Tableau de bord
- Produits
- Vente en espèces
- Commande client
- Stock / inventaire (lecture)
- Caisse (lecture)
- Profil utilisateur

## Prochaine étape (ordre strict)
1) Authentification (OAuth2 + login classique)
2) Synchronisation backend
3) Vente en espèces (prioritaire)
