package com.smboutique.api.service;

import com.smboutique.api.model.Unite;
import java.util.List;
import java.util.Optional;

public interface UniteService {
    List<Unite> findAll();
    List<Unite> findAllByBoutiqueId(Long boutiqueId);
    Optional<Unite> findById(Long id);
    Optional<Unite> findByIdAndBoutiqueId(Long id, Long boutiqueId);

    /* boutique-scoped helpers */
    Optional<Unite> findByBoutiqueIdAndCode(Long boutiqueId, String code);
    Optional<Unite> findByBoutiqueIdAndLibelleIgnoreCase(Long boutiqueId, String libelle);

    /**
     * Create the unit for the given boutique if it does not already exist (concurrency-safe pattern).
     * Returns the existing or newly created entity.
     */
    Unite createIfNotExistsForBoutique(Long boutiqueId, String code, String libelle, String symbole);

    Unite save(Unite unite);
    void deleteById(Long id);
}
