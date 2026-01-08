package com.smboutique.api.service.impl;

import com.smboutique.api.model.ConfigurationMarge;
import com.smboutique.api.repository.ConfigurationMargeRepository;
import com.smboutique.api.service.ConfigurationMargeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Async;

import java.util.Optional;

@Service
public class ConfigurationMargeServiceImpl implements ConfigurationMargeService {

    @Autowired
    private ConfigurationMargeRepository repository;

    /* produitService removed to avoid circular dependency; recomputation handled by MarginRecomputeService */

    @Override
    public Optional<ConfigurationMarge> findByBoutiqueId(Long boutiqueId) {
        return repository.findByBoutiqueId(boutiqueId);
    }
    @Override
    public ConfigurationMarge save(ConfigurationMarge cfg) {
        return repository.save(cfg);
    }

    @Override
    public void deleteById(Long id) {
        repository.deleteById(id);
    }
}
