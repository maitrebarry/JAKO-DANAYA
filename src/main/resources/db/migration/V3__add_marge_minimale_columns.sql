-- Add columns for minimum margins (fixed amount)
ALTER TABLE configuration_marge
  ADD COLUMN marge_minimale_detail DECIMAL(18,6) DEFAULT 0,
  ADD COLUMN marge_minimale_gros DECIMAL(18,6) DEFAULT 0;
