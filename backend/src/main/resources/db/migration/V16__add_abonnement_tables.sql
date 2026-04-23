-- Migration: add abonnement tables (plans, boutique anchor, payments)
-- Generated for automatic creation on startup via Flyway

CREATE TABLE IF NOT EXISTS abonnement_plan (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  libelle VARCHAR(255),
  duree_mois INT,
  prix NUMERIC(12,2),
  devise VARCHAR(8),
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS abonnement_boutique (
  id BIGSERIAL PRIMARY KEY,
  boutique_id BIGINT NOT NULL,
  plan_id BIGINT,
  statut VARCHAR(32),
  date_debut TIMESTAMP WITH TIME ZONE,
  date_fin TIMESTAMP WITH TIME ZONE,
  grace_end_at TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT fk_abonnement_boutique_boutique FOREIGN KEY (boutique_id) REFERENCES boutique(id_boutique) ON DELETE CASCADE,
  CONSTRAINT fk_abonnement_boutique_plan FOREIGN KEY (plan_id) REFERENCES abonnement_plan(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS abonnement_paiement (
  id BIGSERIAL PRIMARY KEY,
  abonnement_id BIGINT NOT NULL,
  reference VARCHAR(128) UNIQUE,
  provider VARCHAR(64),
  mode_paiement VARCHAR(64),
  plan_code VARCHAR(64),
  transaction_ref VARCHAR(128),
  owner_note TEXT,
  preuve_url VARCHAR(512),
  montant NUMERIC(12,2),
  devise VARCHAR(8),
  statut VARCHAR(32),
  paid_at TIMESTAMP WITH TIME ZONE,
  reviewed_by BIGINT,
  review_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT fk_abonnement_paiement_abonnement FOREIGN KEY (abonnement_id) REFERENCES abonnement_boutique(id) ON DELETE CASCADE
);

-- Optional indexes
CREATE INDEX IF NOT EXISTS idx_abonnement_plan_code ON abonnement_plan(UPPER(code));
CREATE INDEX IF NOT EXISTS idx_abonnement_boutique_boutique_id ON abonnement_boutique(boutique_id);
CREATE INDEX IF NOT EXISTS idx_abonnement_paiement_statut ON abonnement_paiement(statut);
