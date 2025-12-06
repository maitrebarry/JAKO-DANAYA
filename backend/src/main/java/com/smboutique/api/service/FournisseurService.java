package com.smboutique.api.service;

import com.smboutique.api.model.Fournisseur;
import java.util.List;
import java.util.Optional;

public interface FournisseurService {
    List<Fournisseur> findAll();
    List<Fournisseur> findAllByBoutiqueId(Long boutiqueId);
    Optional<Fournisseur> findById(Long id);
    Optional<Fournisseur> findByIdAndBoutiqueId(Long id, Long boutiqueId);
    Fournisseur save(Fournisseur fournisseur);
    void deleteById(Long id);
}
