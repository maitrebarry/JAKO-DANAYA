package com.smboutique.api.service;

import com.smboutique.api.model.Inventaire;
import java.util.List;
import java.util.Optional;

public interface InventaireService {
    List<Inventaire> findAll();
    Optional<Inventaire> findById(Long id);
    Inventaire save(Inventaire inventaire);
    void deleteById(Long id);
}
