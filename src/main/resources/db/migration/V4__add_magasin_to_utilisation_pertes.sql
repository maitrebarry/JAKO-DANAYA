-- Add magasin reference to utilisation_pertes
ALTER TABLE utilisation_pertes
  ADD COLUMN id_magasin BIGINT NULL;

-- Add foreign key constraint linking to magasin
ALTER TABLE utilisation_pertes
  ADD CONSTRAINT fk_utili_magasin FOREIGN KEY (id_magasin) REFERENCES magasin(id_magasin);
