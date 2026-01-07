-- Add id_boutique and regulariser to inventaire; add linkage fields to mouvement

ALTER TABLE inventaire ADD COLUMN id_boutique BIGINT NULL;
ALTER TABLE inventaire ADD COLUMN regulariser BOOLEAN DEFAULT FALSE;

ALTER TABLE mouvement ADD COLUMN id_inventaire BIGINT NULL;
ALTER TABLE mouvement ADD COLUMN reference_inventaire VARCHAR(255) NULL;

-- Add foreign key constraints if tables/columns exist
ALTER TABLE inventaire ADD CONSTRAINT fk_inventaire_boutique FOREIGN KEY (id_boutique) REFERENCES boutique(id_boutique);
ALTER TABLE mouvement ADD CONSTRAINT fk_mouvement_inventaire FOREIGN KEY (id_inventaire) REFERENCES inventaire(id_inventaire);

-- Indexes for fast checks
CREATE INDEX idx_inventaire_boutique_regulariser ON inventaire (id_boutique, regulariser);
CREATE INDEX idx_mouvement_id_inventaire ON mouvement (id_inventaire);
