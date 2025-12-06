package com.smboutique.api.service.impl;

import com.smboutique.api.model.Fournisseur;
import com.smboutique.api.repository.FournisseurRepository;
import com.smboutique.api.service.FournisseurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class FournisseurServiceImpl implements FournisseurService {

    @Autowired
    private FournisseurRepository fournisseurRepository;

    @Override
    public List<Fournisseur> findAll() {
        return fournisseurRepository.findAll();
    }

    @Override
    public List<Fournisseur> findAllByBoutiqueId(Long boutiqueId) {
        return fournisseurRepository.findAllByBoutiqueId(boutiqueId);
    }

    @Override
    public Optional<Fournisseur> findById(Long id) {
        return fournisseurRepository.findById(id);
    }

    @Override
    public Optional<Fournisseur> findByIdAndBoutiqueId(Long id, Long boutiqueId) {
        return fournisseurRepository.findByIdAndBoutiqueId(id, boutiqueId);
    }

    @Override
    public Fournisseur save(Fournisseur fournisseur) {
        return fournisseurRepository.save(fournisseur);
    }

    @Override
    public void deleteById(Long id) {
        fournisseurRepository.deleteById(id);
    }
}
