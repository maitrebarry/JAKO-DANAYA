# API : Support du conditionnement (quantiteConditionnement)

Résumé
- Le conditionnement est uniquement une couche de saisie/affichage. Toutes les mutations de stock se font en unités.
- Nous persistons `quantiteConditionnement` (nullable) pour l'historique et les documents (factures, reçus).

Principes
- Si la requête contient `quantiteConditionnement`, le serveur convertit en unités via `produit.nombreUnitesParConditionnement` (doit être > 1) :
```
quantiteEnUnites = quantiteConditionnement * produit.nombreUnitesParConditionnement
```
- Validations serveur :
  - `quantite` et `quantiteConditionnement` doivent être >= 0.
  - Si `venteParConditionnement` est vrai :
    - `produit.nombreUnitesParConditionnement` doit être > 1, sinon 400 Bad Request.
    - `quantiteConditionnement` doit être fourni et >= 1.
    - Si `quantite` est fourni, il doit être <= `quantiteConditionnement * nombreUnitesParConditionnement`.
  - Si `quantiteConditionnement` fourni mais `nombreUnitesParConditionnement` absent ou <= 1 → 400 Bad Request.

Exemples JSON

1) Création Commande Fournisseur (achat par conditionnement)
POST /api/commandes-fournisseurs

{
  "reference": "CMF-2026-01-03-ABC123",
  "dateCommande": "2026-01-03 10:00",
  "fournisseur": { "id": 123 },
  "produitsSelectionnes": [
    { "id_stock": 500, "quantiteConditionnement": 20, "prix": 15000 }
  ],
  "total": 300000
}

- Le serveur calculera `quantite` sur la ligne (en unités) puis persistera `quantiteConditionnement` pour affichage.

2) Vente comptant (cash sale) en conditionnement
POST /api/ventes/cash

{
  "reference": "CASH-1",
  "total": 240000,
  "montantRecu": 240000,
  "produitsSelectionnes": [
    { "id_stock": 501, "venteParConditionnement": true, "quantiteConditionnement": 20, "prix": 12000, "priceMode": "DETAIL" }
  ]
}

- Stock checks and decrements are performed in units: e.g., 20 * multiplicateur.

3) Réception d'une commande (réception partielle ou totale)
POST /api/commandes-fournisseurs/{id}/reception?boutiqueId={boutiqueId}

{
  "lignes": [
    { "ligneId": 50, "quantiteConditionnement": 2 }
  ]
}

- The controller converts to units, updates stock in units, creates `LigneReception` with `quantiteRecu` (units) and stores `quantiteConditionnement` on the `LigneReception` as well.

Transferts
- Transfer requests may include `quantiteConditionnement`. The transfer controller converts to units before sending to service layer.

Notes
- PDF/templates have been updated to display both the conditionnement (e.g., "20 cond") and the equivalent units ("≈ 240 u").
- Frontend must only present the toggle/saisie and send `quantiteConditionnement` when user chooses conditionnement. The backend is the source of truth for conversions and validation.
