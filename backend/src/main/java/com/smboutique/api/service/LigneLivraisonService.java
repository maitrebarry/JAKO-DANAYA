package com.smboutique.api.service;

import com.smboutique.api.model.LigneLivraison;
import java.util.List;
import java.util.Optional;

public interface LigneLivraisonService {
    List<LigneLivraison> findAll();
    Optional<LigneLivraison> findById(Long id);
    LigneLivraison save(LigneLivraison ligneLivraison);
    void deleteById(Long id);

    // list lines for a livraison
    List<LigneLivraison> findByLivraisonId(Long livraisonId);
}
