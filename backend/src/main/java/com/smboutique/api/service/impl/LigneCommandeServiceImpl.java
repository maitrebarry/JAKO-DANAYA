package com.smboutique.api.service.impl;

import com.smboutique.api.model.LigneCommande;
import com.smboutique.api.repository.LigneCommandeRepository;
import com.smboutique.api.service.LigneCommandeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class LigneCommandeServiceImpl implements LigneCommandeService {

    @Autowired
    private LigneCommandeRepository ligneCommandeRepository;

    @Override
    public List<LigneCommande> findAll() {
        return ligneCommandeRepository.findAll();
    }

    @Override
    public Optional<LigneCommande> findById(Long id) {
        return ligneCommandeRepository.findById(id);
    }

    @Override
    public LigneCommande save(LigneCommande ligneCommande) {
        return ligneCommandeRepository.save(ligneCommande);
    }

    @Override
    public void deleteById(Long id) {
        ligneCommandeRepository.deleteById(id);
    }
}
