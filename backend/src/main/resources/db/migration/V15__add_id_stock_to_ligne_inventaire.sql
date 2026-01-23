-- Add nullable id_stock to ligne_inventaire so per-line stock (id_stock) can be persisted
ALTER TABLE ligne_inventaire ADD COLUMN id_stock BIGINT NULL;
ALTER TABLE ligne_inventaire ADD CONSTRAINT fk_ligne_inventaire_stock FOREIGN KEY (id_stock) REFERENCES stock(id_stock);
CREATE INDEX idx_ligne_inventaire_id_stock ON ligne_inventaire(id_stock);