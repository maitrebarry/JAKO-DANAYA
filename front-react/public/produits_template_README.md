Guide d'utilisation — modèle d'import de produits

But : expliquer comment remplir le modèle si vous ne connaissez pas `id_unite`.

Règles importantes
- `nomProduit` : obligatoire.
- `id_unite` : optionnel. Si vous le fournissez, `nombreUnitesParConditionnement` est requis et l'ID doit appartenir à votre boutique.
- `symbole` (préféré) ou `unite_code` (alias historique) / `unite_name` : fournissez plutôt le `unite_name` (ex : « Carton ») ou `symbole` si vous ne connaissez pas l'ID.
  - Si l'unité n'existe pas et que vous avez la permission `UNITE_CREER` (ou êtes SUPERADMIN), cochez « Créer les unités manquantes » lors de l'import pour que le serveur crée l'unité automatiquement.
- `nombreUnitesParConditionnement` : requis si vous fournissez une unité (id, code ou name).
- `quantiteInitiale` : quantité en conditionnements (si `nombreUnitesParConditionnement` fourni) ou en unités de base sinon.

Exemples (voir `produits_template_example.csv` fourni) :
- Utiliser `unite_name` (recommandé si vous ne connaissez pas les IDs) : plus simple et lisible.
- Utiliser `id_unite` seulement si vous avez la liste d'IDs.

Conversion rapide si vous avez un grand fichier
- Méthode 1 (recommandée si vous avez la permission) : renseigner `unite_name` et cocher « Créer les unités manquantes ».
- Méthode 2 (si vous n'avez pas la permission) : récupérer la liste des unités via l'API et utiliser la feuille `units` (ou VLOOKUP) pour remplir `id_unite`.

API utile pour obtenir la liste d'unités (avec token):
  curl -H "Authorization: Bearer <TOKEN>" ${VITE_API_URL:-http://localhost:8085}/api/unites | jq '.[] | {id,libelle,code}'

Générer un XLSX depuis le CSV (optionnel):
- Un petit script est fourni dans `tools/generate_produits_template.js` (il nécessite le paquet `xlsx`).
- Commande :
  node tools/generate_produits_template.js public/produits_template_example.csv public/produits_template.xlsx

Si vous voulez que je génère directement le `.xlsx` dans le dépôt, dites‑le et je l'ajoute.
