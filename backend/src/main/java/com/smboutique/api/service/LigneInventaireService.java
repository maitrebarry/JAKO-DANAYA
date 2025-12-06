package com.smboutique.api.service;

import com.smboutique.api.model.LigneInventaire;
import java.util.List;
import java.util.Optional;

public interface LigneInventaireService {
    List<LigneInventaire> findAll();
    Optional<LigneInventaire> findById(Long id);
    LigneInventaire save(LigneInventaire ligneInventaire);
    void deleteById(Long id);
}
