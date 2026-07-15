-- Reintroduce explicit magasin scope on Inventaire: nullable id_magasin, NULL means
-- the inventaire counts the boutique-level stock (unchanged historical behaviour).
-- A non-null id_magasin scopes the inventaire to exactly that magasin's stock.
--
-- NOTE: this project has no Flyway/Liquibase runner wired up (see other files in
-- this folder) — apply by hand:
--   psql -h <host> -U <user> -d <db> -f V18__inventaire_add_magasin_scope.sql
ALTER TABLE inventaire ADD COLUMN IF NOT EXISTS id_magasin BIGINT REFERENCES magasin(id_magasin);
