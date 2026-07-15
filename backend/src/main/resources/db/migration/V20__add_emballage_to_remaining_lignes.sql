-- Phase 2: extend the multiple-emballages feature (see V19) to achat, réception, commande
-- client and livraison. Each line can now remember which specific emballage (carton, sac...)
-- was used, mirroring the same nullable-FK pattern already applied to ligne_vente.

ALTER TABLE ligne_commande ADD COLUMN id_emballage BIGINT NULL REFERENCES produit_emballage(id_emballage);
ALTER TABLE ligne_reception ADD COLUMN id_emballage BIGINT NULL REFERENCES produit_emballage(id_emballage);
ALTER TABLE ligne_commande_client ADD COLUMN id_emballage BIGINT NULL REFERENCES produit_emballage(id_emballage);
ALTER TABLE ligne_livraison ADD COLUMN id_emballage BIGINT NULL REFERENCES produit_emballage(id_emballage);
