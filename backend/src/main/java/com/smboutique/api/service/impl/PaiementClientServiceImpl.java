package com.smboutique.api.service.impl;

import com.smboutique.api.model.PaiementClient;
import com.smboutique.api.repository.PaiementClientRepository;
import com.smboutique.api.service.PaiementClientService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class PaiementClientServiceImpl implements PaiementClientService {

    @Autowired
    private PaiementClientRepository paiementClientRepository;

    @Override
    public List<PaiementClient> findAll() {
        return paiementClientRepository.findAll();
    }

    @Override
    public Optional<PaiementClient> findById(Long id) {
        return paiementClientRepository.findById(id);
    }

    @Override
    public PaiementClient save(PaiementClient paiementClient) {
        return paiementClientRepository.save(paiementClient);
    }

    @Override
    public void deleteById(Long id) {
        paiementClientRepository.deleteById(id);
    }

    @Override
    public List<PaiementClient> findByBoutiqueId(Long boutiqueId) {
        return paiementClientRepository.findByCommandeClientBoutiqueId(boutiqueId);
    }

    @Override
    public List<PaiementClient> findByCommandeClientId(Long commandeClientId) {
        return paiementClientRepository.findByCommandeClientId(commandeClientId);
    }
}
