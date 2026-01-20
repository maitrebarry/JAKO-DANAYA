-- Migration: add `code` to `unite`, backfill values and add uniqueness constraints
-- Target DB: MySQL 8+
-- Purpose: ensure boutique-scoped uniqueness for units and speed up lookups by code.

-- WARNING: DDL in MySQL issues implicit commits. Review and run in maintenance window on production.

/* 1) Safety checks: list potential conflicts that must be resolved manually before applying the migration */
-- Find duplicate libelle per boutique (case-insensitive)
SELECT id_boutique, lower(libelle) AS libelle_lc, count(*) AS cnt
FROM unite
GROUP BY id_boutique, libelle_lc
HAVING cnt > 1;

-- Find duplicate (after a planned code backfill) by computed code
SELECT id_boutique, LOWER(REPLACE(libelle, ' ', '_')) AS expected_code, COUNT(*) AS cnt
FROM unite
GROUP BY id_boutique, expected_code
HAVING cnt > 1;

/* 2) Backfill and schema change
   - add `code` column (nullable) so existing rows are not affected
   - populate `code` with a deterministic slug derived from `libelle` (lower, spaces -> underscores)
   - ensure non-null codes where possible (keeps migration reversible)
*/

ALTER TABLE unite ADD COLUMN IF NOT EXISTS code VARCHAR(150) DEFAULT NULL;

UPDATE unite
SET code = LOWER(REPLACE(TRIM(libelle), ' ', '_'))
WHERE code IS NULL AND libelle IS NOT NULL AND TRIM(libelle) <> '';

-- For rows with empty libelle, set a fallback code using the id (should be rare)
UPDATE unite
SET code = CONCAT('u', id)
WHERE code IS NULL;

/* 3) Create indexes / uniqueness constraints
   - libelle uniqueness per boutique: MySQL default collation is usually case-insensitive, so
     a unique index on (id_boutique, libelle) will enforce case-insensitive uniqueness.
   - code uniqueness per boutique: create unique index on (id_boutique, code)
*/

-- Ensure there are no remaining duplicates before creating the indexes
SELECT id_boutique, libelle, COUNT(*) FROM unite GROUP BY id_boutique, libelle HAVING COUNT(*) > 1;
SELECT id_boutique, code, COUNT(*) FROM unite GROUP BY id_boutique, code HAVING COUNT(*) > 1;

-- If the above SELECTs return rows, resolve duplicates before proceeding.

ALTER TABLE unite
  ADD CONSTRAINT ux_unite_boutique_libelle UNIQUE (id_boutique, libelle);

ALTER TABLE unite
  ADD CONSTRAINT ux_unite_boutique_code UNIQUE (id_boutique, code);

/* 4) Post-migration recommendations (manual)
   - Add a small backfill job in the application to set `code` for newly created units when saving.
   - Optionally, add a DB trigger to populate `code` automatically (not added here to keep migration simple).
   - Monitor for exceptions during the first days after deployment (duplicate-related errors indicate outstanding data issues).
*/

-- End of migration
