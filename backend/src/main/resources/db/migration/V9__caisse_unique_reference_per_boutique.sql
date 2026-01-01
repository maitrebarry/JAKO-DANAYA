-- Ensure reference is unique per boutique to avoid collisions across boutiques
ALTER TABLE caisse ADD CONSTRAINT uq_caisse_boutique_reference UNIQUE (id_boutique, reference);
