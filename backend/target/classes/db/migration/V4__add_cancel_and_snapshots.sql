-- Add cancellation metadata to reception and paiement, and snapshots to ligne_reception

ALTER TABLE reception
  ADD COLUMN annule BOOLEAN DEFAULT FALSE,
  ADD COLUMN annule_at DATETIME NULL,
  ADD COLUMN annule_par BIGINT NULL,
  ADD COLUMN annule_reason VARCHAR(255) NULL;

ALTER TABLE paiement
  ADD COLUMN annule BOOLEAN DEFAULT FALSE,
  ADD COLUMN annule_at DATETIME NULL,
  ADD COLUMN annule_par BIGINT NULL,
  ADD COLUMN annule_reason VARCHAR(255) NULL;

ALTER TABLE ligne_reception
  ADD COLUMN before_stock_quantite INTEGER NULL,
  ADD COLUMN before_stock_cost_average DECIMAL(19,6) NULL,
  ADD COLUMN before_produit_prix_achat INTEGER NULL;
