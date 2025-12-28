-- Add references to stock and boutique in mouvement to record origin of movement
ALTER TABLE mouvement ADD COLUMN id_stock BIGINT NULL;
ALTER TABLE mouvement ADD COLUMN id_boutique BIGINT NULL;
-- optional: add foreign keys if desired (omitted for portability)
