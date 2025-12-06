package com.smboutique.api.service.impl;

import com.smboutique.api.model.LigneCommandeClient;
import com.smboutique.api.repository.LigneCommandeClientRepository;
import com.smboutique.api.service.LigneCommandeClientService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class LigneCommandeClientServiceImpl implements LigneCommandeClientService {

    @Autowired
    private LigneCommandeClientRepository ligneCommandeClientRepository;

    @Override
    public List<LigneCommandeClient> findAll() {
        return ligneCommandeClientRepository.findAll();
    }

    @Override
    public Optional<LigneCommandeClient> findById(Long id) {
        return ligneCommandeClientRepository.findById(id);
    }

    @Override
    public LigneCommandeClient save(LigneCommandeClient ligneCommandeClient) {
        return ligneCommandeClientRepository.save(ligneCommandeClient);
    }

    @Override
    public void deleteById(Long id) {
        ligneCommandeClientRepository.deleteById(id);
    }
}
