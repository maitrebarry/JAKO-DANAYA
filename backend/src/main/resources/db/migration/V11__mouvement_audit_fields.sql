-- Add audit fields to mouvement table
ALTER TABLE mouvement
  ADD COLUMN id_utilisateur BIGINT NULL,
  ADD COLUMN sous_type VARCHAR(128) NULL,
  ADD COLUMN description TEXT NULL,
  ADD COLUMN reference_id BIGINT NULL,
  ADD COLUMN id_magasin BIGINT NULL;

-- Add foreign key constraint to utilisateur if table exists
ALTER TABLE mouvement
  ADD CONSTRAINT fk_mouvement_utilisateur FOREIGN KEY (id_utilisateur) REFERENCES utilisateur(id) ON DELETE SET NULL;

-- Add foreign key constraint to magasin if table exists (if not, this will fail and should be created in a subsequent migration)
ALTER TABLE mouvement
  ADD CONSTRAINT fk_mouvement_magasin FOREIGN KEY (id_magasin) REFERENCES magasin(id) ON DELETE SET NULL;
