package com.smboutique.api.service;

import com.smboutique.api.model.Paiement;
import java.util.List;
import java.util.Optional;

public interface PaiementService {
    List<Paiement> findAll();
    Optional<Paiement> findById(Long id);
    Paiement save(Paiement paiement);
    void deleteById(Long id);
    java.util.List<Paiement> findByBoutiqueId(Long boutiqueId);
    java.util.List<Paiement> findByCommandeFournisseurId(Long commandeId);
}
