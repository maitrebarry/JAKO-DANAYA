package com.smboutique.api.service;

import com.smboutique.api.model.LigneVente;
import java.util.List;
import java.util.Optional;

public interface LigneVenteService {
    List<LigneVente> findAll();
    Optional<LigneVente> findById(Long id);
    LigneVente save(LigneVente ligneVente);
    void deleteById(Long id);
}
