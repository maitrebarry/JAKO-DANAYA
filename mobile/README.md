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

Commande recommandée :
- `expo start` puis scanner le QR code

## Configuration
- `EXPO_PUBLIC_API_BASE_URL` : base URL API (ex: http://localhost:8085)

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
