-- Flyway migration to create configuration_marge table
CREATE TABLE IF NOT EXISTS configuration_marge (
  id_configuration_marge BIGINT AUTO_INCREMENT PRIMARY KEY,
  type_marge VARCHAR(32),
  valeur_detail DECIMAL(18,6) DEFAULT 0,
  valeur_gros DECIMAL(18,6) DEFAULT 0,
  id_boutique BIGINT,
  CONSTRAINT fk_cfg_boutique FOREIGN KEY (id_boutique) REFERENCES boutique(id_boutique)
);
