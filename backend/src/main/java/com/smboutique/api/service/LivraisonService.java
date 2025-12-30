package com.smboutique.api.service;

import com.smboutique.api.model.Livraison;
import java.util.List;
import java.util.Optional;

public interface LivraisonService {
    List<Livraison> findAll();
    Optional<Livraison> findById(Long id);
    Livraison save(Livraison livraison);
    void deleteById(Long id);

    // list livraisons for ventes by boutique id
    List<Livraison> findByBoutiqueId(Long boutiqueId);
}
