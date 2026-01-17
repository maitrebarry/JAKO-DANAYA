-- Safe deduplication of caisse.reference per boutique
-- Strategy:
-- For each (id_boutique, reference) group with >1 rows:
--  - If there are NO dependent rows in caisse_movement, caisse_transaction, paiement, paiement_client, depense that reference that reference for the same boutique, then we can safely rename all but the first row by appending a suffix "-DUP-<n>" to make them unique.
--  - Otherwise, we insert a record into data_cleanup to flag the ambiguous group for manual resolution.

CREATE TABLE IF NOT EXISTS data_cleanup (
    id BIGSERIAL PRIMARY KEY,
    entity VARCHAR(128) NOT NULL,
    entity_ids TEXT NOT NULL,
    boutique_id BIGINT,
    "reference" VARCHAR(255),
    issue VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

DO $$
DECLARE
  r RECORD;
  ids BIGINT[];
  keep_id BIGINT;
  i INT;
  newref TEXT;
  dep_count INT;
BEGIN
  FOR r IN
    SELECT id_boutique AS b, reference AS ref, array_agg(id_caisse ORDER BY id_caisse) AS ids, count(*) AS cnt
    FROM caisse
    GROUP BY id_boutique, reference
    HAVING count(*) > 1
  LOOP
    ids := r.ids;

    -- Count dep rows referring to this reference for this boutique
    SELECT COUNT(*) INTO dep_count FROM (
      SELECT id FROM caisse_movement WHERE reference_caisse = r.ref AND boutique_id = r.b
      UNION ALL
      SELECT id FROM caisse_transaction WHERE reference_caisse = r.ref AND boutique_id = r.b
      UNION ALL
      SELECT id FROM paiement WHERE reference_caisse = r.ref AND boutique_id = r.b
      UNION ALL
      SELECT id FROM paiement_client WHERE reference_caisse = r.ref AND boutique_id = r.b
      UNION ALL
      SELECT id FROM depense WHERE reference_caisse = r.ref AND boutique_id = r.b
    ) t;

    IF dep_count = 0 THEN
      -- Safe to rename duplicates: keep first id as canonical, rename others
      keep_id := ids[1];
      FOR i IN 2..array_length(ids,1) LOOP
        newref := r.ref || '-DUP-' || (i-1);
        -- ensure uniqueness (unlikely collision), append extra suffix until unique
        WHILE EXISTS (SELECT 1 FROM caisse WHERE id_boutique = r.b AND reference = newref) LOOP
          newref := newref || '-X';
        END LOOP;
        UPDATE caisse SET reference = newref WHERE id_caisse = ids[i];
      END LOOP;
    ELSE
      -- Flag for manual review
      INSERT INTO data_cleanup(entity, entity_ids, boutique_id, "reference", issue)
        VALUES('caisse', array_to_string(ids, ','), r.b, r.ref, 'duplicate_reference_with_dependencies');
    END IF;
  END LOOP;
END$$;

-- Provide a simple report if someone wants to inspect generated cleanup entries
SELECT * FROM data_cleanup WHERE issue = 'duplicate_reference_with_dependencies';
