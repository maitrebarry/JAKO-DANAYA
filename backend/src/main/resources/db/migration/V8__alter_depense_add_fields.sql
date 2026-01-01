-- Add missing columns and indexes to existing depense table to support workflow and auditing
ALTER TABLE depense ADD COLUMN IF NOT EXISTS reference VARCHAR(128);
ALTER TABLE depense ADD COLUMN IF NOT EXISTS boutique_id BIGINT;
ALTER TABLE depense ADD COLUMN IF NOT EXISTS createur_id BIGINT;
ALTER TABLE depense ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'EN_ATTENTE';
ALTER TABLE depense ADD COLUMN IF NOT EXISTS validator_id BIGINT;
ALTER TABLE depense ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP;
ALTER TABLE depense ADD COLUMN IF NOT EXISTS annule_par BIGINT;
ALTER TABLE depense ADD COLUMN IF NOT EXISTS annule_at TIMESTAMP;
ALTER TABLE depense ADD COLUMN IF NOT EXISTS annule_reason VARCHAR(1024);
ALTER TABLE depense ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_depense_status ON depense(status);
CREATE INDEX IF NOT EXISTS idx_depense_boutique ON depense(boutique_id);
