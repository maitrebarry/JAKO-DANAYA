-- Add quantite_conditionnement column to ligne_commande, ligne_reception, ligne_vente and ligne_commande_client
ALTER TABLE ligne_commande ADD COLUMN quantite_conditionnement INTEGER NULL;
ALTER TABLE ligne_reception ADD COLUMN quantite_conditionnement INTEGER NULL;
ALTER TABLE ligne_vente ADD COLUMN quantite_conditionnement INTEGER NULL;
ALTER TABLE ligne_commande_client ADD COLUMN quantite_conditionnement INTEGER NULL;