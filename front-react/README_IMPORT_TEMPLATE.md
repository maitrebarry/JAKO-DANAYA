Comment utiliser le modèle d'import de produits

Fichiers fournis (front-react/public):
- `produits_template.xlsx` : modèle XLSX (anciennement fourni). Si vous ne connaissez pas `id_unite`, utilisez plutôt :
- `produits_template_example.csv` : exemple prêt à l'emploi (contient 4 lignes d'exemple et montre l'usage de `unite_name`).
- `produits_template_README.md` : documentation courte embarquée.

Scénarios recommandés :
- Vous ne connaissez **pas** les IDs des unités → remplissez `unite_name` et cochez l'option **Créer les unités manquantes** lors de l'import (si vous avez la permission `UNITE_CREER`).
- Vous ne pouvez pas créer d'unités → exportez la liste d'unités via l'API et utilisez VLOOKUP pour remplir `id_unite` avant import.

Générer un XLSX depuis le CSV (locally):
1. Installer le paquet: `cd front-react && npm i xlsx --no-save`
2. Générer: `node ../tools/generate_produits_template.js public/produits_template_example.csv public/produits_template.xlsx`

Si vous voulez, je peux :
- Générer et committer le `.xlsx` à votre place, ou
- Fournir un petit script pour convertir automatiquement un export fournisseur en format attendu.
