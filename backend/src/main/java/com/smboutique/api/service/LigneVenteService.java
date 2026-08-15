package com.smboutique.api.service;

import com.smboutique.api.model.LigneVente;
import java.util.List;
import java.util.Optional;

public interface LigneVenteService {
    List<LigneVente> findAll();
    Optional<LigneVente> findById(Long id);
    LigneVente save(LigneVente ligneVente);
    void deleteById(Long id);

    /** Lignes de vente pour une boutique (ou toutes si boutiqueId est null), vente et produit
     * déjà chargés en une seule requête - à utiliser à la place de findAll() + filtrage Java. */
    List<LigneVente> findAllForDashboard(Long boutiqueId);
}
