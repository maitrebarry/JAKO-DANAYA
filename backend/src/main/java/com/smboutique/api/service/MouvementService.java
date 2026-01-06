package com.smboutique.api.service;

import com.smboutique.api.model.Mouvement;
import java.util.List;
import java.util.Optional;

public interface MouvementService {
    List<Mouvement> findAll();
    Optional<Mouvement> findById(Long id);
    Mouvement save(Mouvement mouvement);
    void deleteById(Long id);

    List<Mouvement> search(Long userId, String type, String sousType, Long boutiqueId, Long magasinId, Long referenceId, java.time.LocalDateTime from, java.time.LocalDateTime to);

    // Paginated search
    MouvementSearchResult searchPage(Long userId, String type, String sousType, Long boutiqueId, Long magasinId, Long referenceId, java.time.LocalDateTime from, java.time.LocalDateTime to, int page, int size);

    // Generic logging API for actions
    void log(String type, String sousType, String description, Long referenceId, Long boutiqueId, Long magasinId, Long utilisateurId, Double montant);

    // Convenience helper to log a sale
    default void logSale(java.util.Optional<com.smboutique.api.model.Vente> venteOpt, Long utilisateurId) {
        venteOpt.ifPresent(vente -> {
            String desc = "Vente enregistrée";
            Long boutiqueId = vente.getBoutique() != null ? vente.getBoutique().getId() : null;
            Double montant = vente.getMontantTotal() != null ? Double.valueOf(vente.getMontantTotal()) : null;
            log("VENTE", "CASH", desc, vente.getId(), boutiqueId, null, utilisateurId, montant);
        });
    }
}
