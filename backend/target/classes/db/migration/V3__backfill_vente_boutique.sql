-- Backfill ventes missing id_boutique using the creating user's boutique (if any)
-- This will set id_boutique for vente rows where it's null but utilisateur has a boutique

UPDATE vente v
SET id_boutique = (
  SELECT u.id_boutique FROM utilisateur u WHERE u.id_utilisateur = v.id_utilisateur
)
WHERE v.id_boutique IS NULL
  AND v.id_utilisateur IS NOT NULL;

-- Note: rows without utilisateur or where utilisateur has no boutique will remain unchanged.
