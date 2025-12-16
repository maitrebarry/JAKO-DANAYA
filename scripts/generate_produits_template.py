#!/usr/bin/env python3
# Generate an XLSX template with 50 sample products with real names and uniteIds 1..6
from openpyxl import Workbook
from urllib.parse import quote_plus
import os

product_names = [
    "Sucre blanc 1kg","Farine de blé 1kg","Riz parfumé 1kg","Huile d'olive 500ml","Savon liquide 500ml",
    "Savon solide 200g","Café moulu 250g","Thé en sachet 20x","Eau minérale 1.5L","Lait UHT 1L",
    "Beurre doux 250g","Fromage frais 200g","Yaourt nature 125g","Pain de mie 500g","Biscuits secs 200g",
    "Chocolat noir 100g","Jus d'orange 1L","Pâtes spaghetti 500g","Sauce tomate 400g","Miel pur 250g",
    "Confiture fraise 370g","Sel iodé 1kg","Poivre moulu 50g","Riz basmati 1kg","Céréales petit-déjeuner 375g",
    "Eau gazeuse 1.5L","Papier toilette 4pcs","Lessive liquide 2L","Détergent vaisselle 750ml","Shampoing 250ml",
    "Gel douche 250ml","Crème hydratante 200ml","Parfum corporel 100ml","Savon de Marseille 200g","Riz complet 1kg",
    "Huile tournesol 1L","Lentilles sèches 500g","Haricots rouges 500g","Maïs en conserve 300g","Thon en conserve 160g",
    "Bouillon cube 12pcs","Fromage râpé 200g","Sauce piment 200g","Sauce soja 150ml","Biscuits chocolatés 200g",
    "Chips sel 150g","Saucisson sec 200g","Poulet congelé 1kg","Steak haché 500g","Poisson surgelé 500g"
]

unit_labels = ["Pièce","Boîte","Kg","Litre","Pack","Mètre"]

# Headers
headers = ["nomProduit", "productImage", "prixAchat", "prixDetail", "prixEnGros", "alerteStock", "id_unite", "nombreUnitesParConditionnement", "quantiteInitiale", "magasinIds"]

wb = Workbook()
sheet = wb.active
sheet.title = 'Produits'

# header
for i, h in enumerate(headers):
    sheet.cell(row=1, column=i+1, value=h)

# rows
for r in range(1, 51):
    row_index = r + 1
    name = product_names[(r-1) % len(product_names)]
    # image placeholder
    image_url = f"https://via.placeholder.com/600x400.png?text={quote_plus(name)}"
    prixAchat = 500 + r*10
    prixDetail = 800 + r*12
    prixEnGros = 700 + r*11
    alerteStock = 5 + (r % 10)

    # Conditionnements pour certains produits (tous les 3 produits)
    id_unite = ""
    nombreUnitesParConditionnement = ""
    quantiteInitiale = 10 + (r % 20)  # Stock initial par défaut

    if r % 3 == 0:  # Tous les 3 produits ont un conditionnement
        # Distribuer les identifiants d'unité 1..6 cycliquement
        id_unite = ((r - 1) % len(unit_labels)) + 1
        nombreUnitesParConditionnement = 6 + (r % 18)  # 6 à 24 unités par conditionnement
        quantiteInitiale = 2 + (r % 8)  # 2 à 10 conditionnements en stock

    # Write to sheet
    sheet.cell(row=row_index, column=1, value=name)
    sheet.cell(row=row_index, column=2, value=image_url)
    sheet.cell(row=row_index, column=3, value=prixAchat)
    sheet.cell(row=row_index, column=4, value=prixDetail)
    sheet.cell(row=row_index, column=5, value=prixEnGros)
    sheet.cell(row=row_index, column=6, value=alerteStock)
    sheet.cell(row=row_index, column=7, value=id_unite)
    sheet.cell(row=row_index, column=8, value=nombreUnitesParConditionnement)
    sheet.cell(row=row_index, column=9, value=quantiteInitiale)
    sheet.cell(row=row_index, column=10, value="")

# ensure public folder
outdir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'front-react', 'public')
if not os.path.exists(outdir):
    os.makedirs(outdir, exist_ok=True)
outfile = os.path.join(outdir, 'produits_template.xlsx')
wb.save(outfile)
print('Wrote', outfile)
