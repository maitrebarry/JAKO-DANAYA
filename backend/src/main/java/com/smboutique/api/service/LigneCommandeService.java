package com.smboutique.api.service;

import com.smboutique.api.model.LigneCommande;
import java.util.List;
import java.util.Optional;

public interface LigneCommandeService {
    List<LigneCommande> findAll();
    Optional<LigneCommande> findById(Long id);
    LigneCommande save(LigneCommande ligneCommande);
    void deleteById(Long id);
}
