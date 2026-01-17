-- Create depense table
CREATE TABLE depense (
    id BIGSERIAL PRIMARY KEY,
    reference VARCHAR(128) NOT NULL UNIQUE,
    montant INTEGER NOT NULL,
    raison VARCHAR(1024),
    boutique_id BIGINT,
    createur_id BIGINT,
    status VARCHAR(32) NOT NULL DEFAULT 'EN_ATTENTE',
    reference_caisse VARCHAR(128),
    validator_id BIGINT,
    validated_at TIMESTAMP,
    annule_par BIGINT,
    annule_at TIMESTAMP,
    annule_reason VARCHAR(1024),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_depense_status ON depense(status);
CREATE INDEX idx_depense_boutique ON depense(boutique_id);
