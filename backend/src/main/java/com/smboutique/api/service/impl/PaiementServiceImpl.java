package com.smboutique.api.service.impl;

import com.smboutique.api.model.Paiement;
import com.smboutique.api.repository.PaiementRepository;
import com.smboutique.api.service.PaiementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class PaiementServiceImpl implements PaiementService {

    @Autowired
    private PaiementRepository paiementRepository;

    @Override
    public List<Paiement> findAll() {
        return paiementRepository.findAll();
    }

    @Override
    public Optional<Paiement> findById(Long id) {
        return paiementRepository.findById(id);
    }

    @Override
    public Paiement save(Paiement paiement) {
        return paiementRepository.save(paiement);
    }

    @Override
    public void deleteById(Long id) {
        paiementRepository.deleteById(id);
    }

    @Override
    public java.util.List<Paiement> findByBoutiqueId(Long boutiqueId) {
        return paiementRepository.findByBoutiqueId(boutiqueId);
    }

    @Override
    public java.util.List<Paiement> findByCommandeFournisseurId(Long commandeId) {
        return paiementRepository.findByCommandeFournisseurId(commandeId);
    }
}
