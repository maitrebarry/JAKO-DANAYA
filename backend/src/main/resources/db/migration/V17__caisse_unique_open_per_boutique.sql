-- Enforce at most one OUVERTE caisse per boutique at the database level.
-- Application code (CaisseController.createCaisse) already rejects a second
-- open caisse, but that check is a plain read-then-write and is not immune
-- to a true race between two concurrent requests. This partial unique index
-- closes that race completely: any INSERT/UPDATE that would leave a second
-- 'OUVERTE' row for the same boutique fails at the DB level.
--
-- NOTE: this project has no Flyway/Liquibase runner wired up (no migration
-- tool dependency in pom.xml, ddl-auto=validate on local/prod) — this file
-- is kept for documentation/history like the other db/migration/*.sql
-- scripts, and must be applied by hand:
--   psql -h <host> -U <user> -d <db> -f V17__caisse_unique_open_per_boutique.sql
-- Verify first that no boutique currently has more than one OUVERTE caisse:
--   SELECT id_boutique, count(*) FROM caisse WHERE statut = 'OUVERTE' GROUP BY id_boutique HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_caisse_boutique_statut_ouverte
    ON caisse (id_boutique)
    WHERE statut = 'OUVERTE';
