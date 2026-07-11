-- Track which user created each account, so delegated managers (Gérant) can be
-- restricted to only the users they personally created when assigning permissions.
-- ON DELETE SET NULL: if the creator (e.g. a departing Gérant) is later deleted,
-- their created users are not blocked from deletion and simply become "unowned"
-- (still fully manageable by the boutique's Propriétaire/Administrateur/Superadmin,
-- who can reassign them to a new manager).
ALTER TABLE utilisateur ADD COLUMN id_createur BIGINT NULL;
ALTER TABLE utilisateur ADD CONSTRAINT fk_utilisateur_createur FOREIGN KEY (id_createur) REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL;
CREATE INDEX idx_utilisateur_id_createur ON utilisateur(id_createur);
