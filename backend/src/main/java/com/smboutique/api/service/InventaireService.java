package com.smboutique.api.service;

import com.smboutique.api.model.Inventaire;
import java.util.List;
import java.util.Optional;

public interface InventaireService {
    List<Inventaire> findAll();
    Optional<Inventaire> findById(Long id);
    Inventaire save(Inventaire inventaire);
    void deleteById(Long id);

    List<Inventaire> findByBoutiqueId(Long boutiqueId);
    boolean existsActiveInventoryForBoutique(Long boutiqueId);

    /**
     * Check for an existing active inventory that would conflict with adding a ligne for given product to the provided inventaire.
     * Throws RuntimeException with a descriptive message when a conflict is found (mapped to HTTP 409 by controller).
     */
    void checkActiveInventoryConflictOnAddingLine(com.smboutique.api.model.Inventaire inventaire, Long produitId);

    com.smboutique.api.model.LigneInventaire saveLigne(com.smboutique.api.model.LigneInventaire ligne);
    Optional<com.smboutique.api.model.LigneInventaire> findLigneById(Long id);
    void deleteLigne(Long id);

    RegularisationResult regularizeInventory(Long inventaireId, com.smboutique.api.model.Utilisateur user);

    /**
     * Retourne une référence d'inventaire pré-générée (ex: R-IV-N°000123) calculée à partir du prochain id.
     */
    String getNextReference();

    class RegularisationResult {
        public java.util.List<Long> mouvementsCreated = new java.util.ArrayList<>();
        public int totalValeurTheorique = 0;
        public int totalValeurPhysique = 0;
        public int totalValeurEcart = 0;
    }
}
