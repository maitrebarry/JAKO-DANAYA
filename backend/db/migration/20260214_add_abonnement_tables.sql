-- Migration: 20260214_add_abonnement_tables.sql
-- Ajoute les tables utilisées par le module abonnement

BEGIN;

-- Plans d'abonnement
CREATE TABLE IF NOT EXISTS abonnement_plan (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  libelle VARCHAR(255) NOT NULL,
  duree_mois INTEGER NOT NULL,
  prix NUMERIC(12,2) NOT NULL DEFAULT 0,
  devise VARCHAR(10) NOT NULL DEFAULT 'USD',
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Abonnements attachés aux boutiques (anchor records)
CREATE TABLE IF NOT EXISTS abonnement_boutique (
  id BIGSERIAL PRIMARY KEY,
  boutique_id BIGINT NOT NULL,
  plan_id BIGINT NOT NULL,
  statut VARCHAR(32) NOT NULL,
  date_debut TIMESTAMP WITH TIME ZONE,
  date_fin TIMESTAMP WITH TIME ZONE,
  grace_end_at TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_abonnement_boutique_plan FOREIGN KEY (plan_id) REFERENCES abonnement_plan(id)
);

-- Paiements liés aux abonnements
CREATE TABLE IF NOT EXISTS abonnement_paiement (
  id BIGSERIAL PRIMARY KEY,
  abonnement_id BIGINT NOT NULL,
  reference VARCHAR(128) NOT NULL UNIQUE,
  provider VARCHAR(64),
  mode_paiement VARCHAR(64),
  plan_code VARCHAR(50),
  transaction_ref VARCHAR(128),
  owner_note TEXT,
  preuve_url VARCHAR(1024),
  review_note TEXT,
  reviewed_by BIGINT,
  montant NUMERIC(12,2),
  devise VARCHAR(10),
  statut VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT fk_abonnement_paiement_abonnement FOREIGN KEY (abonnement_id) REFERENCES abonnement_boutique(id)
);

-- Indexes utiles
CREATE INDEX IF NOT EXISTS idx_abonnement_boutique_boutique_id ON abonnement_boutique(boutique_id);
CREATE INDEX IF NOT EXISTS idx_abonnement_paiement_abonnement_id ON abonnement_paiement(abonnement_id);
CREATE INDEX IF NOT EXISTS idx_abonnement_plan_code ON abonnement_plan(UPPER(code));

COMMIT;
