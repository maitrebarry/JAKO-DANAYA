package com.smboutique.api.service;

import com.smboutique.api.model.LigneCommandeClient;
import java.util.List;
import java.util.Optional;

public interface LigneCommandeClientService {
    List<LigneCommandeClient> findAll();
    Optional<LigneCommandeClient> findById(Long id);
    LigneCommandeClient save(LigneCommandeClient ligneCommandeClient);
    void deleteById(Long id);
}
