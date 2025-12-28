-- Add price_mode (DETAIL/GROS) and qte_livre to ligne_vente
ALTER TABLE ligne_vente ADD COLUMN price_mode VARCHAR(10) DEFAULT 'DETAIL';
ALTER TABLE ligne_vente ADD COLUMN qte_livre INTEGER DEFAULT 0;
