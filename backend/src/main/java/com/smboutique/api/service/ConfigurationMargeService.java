package com.smboutique.api.service;

import com.smboutique.api.model.ConfigurationMarge;

import java.util.Optional;

public interface ConfigurationMargeService {
    Optional<ConfigurationMarge> findByBoutiqueId(Long boutiqueId);
    ConfigurationMarge save(ConfigurationMarge cfg);
    void deleteById(Long id);
}
