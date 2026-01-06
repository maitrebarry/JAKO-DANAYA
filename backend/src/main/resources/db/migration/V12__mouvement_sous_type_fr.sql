-- Migration: normaliser les sous-types d'actions en français
-- Convertit les anciennes valeurs anglaises en leurs équivalents français

UPDATE mouvement SET sous_type = 'CREATION' WHERE UPPER(COALESCE(sous_type, '')) = 'CREATE';
UPDATE mouvement SET sous_type = 'MODIFICATION' WHERE UPPER(COALESCE(sous_type, '')) = 'MODIFY';
UPDATE mouvement SET sous_type = 'SUPPRESSION' WHERE UPPER(COALESCE(sous_type, '')) = 'DELETE';
UPDATE mouvement SET sous_type = 'ANNULATION' WHERE UPPER(COALESCE(sous_type, '')) IN ('CANCEL', 'CANCELLED');
UPDATE mouvement SET sous_type = 'OUVERTURE' WHERE UPPER(COALESCE(sous_type, '')) = 'OPEN';
UPDATE mouvement SET sous_type = 'ESPECE' WHERE UPPER(COALESCE(sous_type, '')) = 'CASH';
UPDATE mouvement SET sous_type = 'CONNEXION' WHERE UPPER(COALESCE(sous_type, '')) = 'LOGIN';

-- Optionnel: harmoniser espaces et casse
UPDATE mouvement SET sous_type = TRIM(UPPER(sous_type));