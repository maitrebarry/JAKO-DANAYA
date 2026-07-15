-- Phase 1: multiple emballages ("Ça se vend aussi comment ?") per produit.
-- A produit can now have several simultaneous packaging options (Carton x24, Sac x6...)
-- instead of exactly one. tbl_product.id_unite / nombre_unites_par_conditionnement remain
-- as a write-through mirror of whichever emballage is flagged est_par_defaut, so every flow
-- that still reads those two flat columns keeps working unchanged.

CREATE TABLE produit_emballage (
    id_emballage    BIGSERIAL PRIMARY KEY,
    id_produit      BIGINT NOT NULL REFERENCES tbl_product(id_produit) ON DELETE CASCADE,
    id_unite        BIGINT NOT NULL REFERENCES unite(id_unite),
    nombre_unites   INTEGER NOT NULL CHECK (nombre_unites > 0),
    est_par_defaut  BOOLEAN NOT NULL DEFAULT FALSE,
    date_creation   TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT ux_produit_emballage_produit_unite UNIQUE (id_produit, id_unite)
);

-- Only one default emballage per produit
CREATE UNIQUE INDEX ux_produit_emballage_default
    ON produit_emballage(id_produit) WHERE est_par_defaut = TRUE;

-- Backfill: every produit that currently has a conditionnement (id_unite set)
-- becomes exactly one emballage row, flagged default. Pure unit-only products
-- (id_unite IS NULL) intentionally get NO row here.
INSERT INTO produit_emballage (id_produit, id_unite, nombre_unites, est_par_defaut, date_creation)
SELECT id_produit, id_unite, COALESCE(nombre_unites_par_conditionnement, 1), TRUE, COALESCE(date_creation, now())
FROM tbl_product
WHERE id_unite IS NOT NULL;

-- New nullable FK on ligne_vente so future sale lines remember which emballage was used.
ALTER TABLE ligne_vente ADD COLUMN id_emballage BIGINT NULL REFERENCES produit_emballage(id_emballage);

-- Backfill historical sale lines: at this point in time each produit has at most
-- ONE emballage (by construction above), so this join is unambiguous and safe.
UPDATE ligne_vente lv
SET id_emballage = pe.id_emballage
FROM produit_emballage pe
WHERE lv.id_produit = pe.id_produit
  AND lv.quantite_conditionnement IS NOT NULL;
