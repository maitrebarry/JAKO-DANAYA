-- Add boutique reference to utilisation_pertes
ALTER TABLE utilisation_pertes
  ADD COLUMN id_boutique BIGINT NULL;

-- Add foreign key constraint linking to boutique
ALTER TABLE utilisation_pertes
  ADD CONSTRAINT fk_utili_boutique FOREIGN KEY (id_boutique) REFERENCES boutique(id_boutique);
