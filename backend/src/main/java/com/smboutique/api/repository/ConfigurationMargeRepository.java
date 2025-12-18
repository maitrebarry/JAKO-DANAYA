package com.smboutique.api.repository;

import com.smboutique.api.model.ConfigurationMarge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ConfigurationMargeRepository extends JpaRepository<ConfigurationMarge, Long> {
    Optional<ConfigurationMarge> findByBoutiqueId(Long boutiqueId);
}
