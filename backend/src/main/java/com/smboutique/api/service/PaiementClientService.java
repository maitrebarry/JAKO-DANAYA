package com.smboutique.api.service;

import com.smboutique.api.model.PaiementClient;
import java.util.List;
import java.util.Optional;

public interface PaiementClientService {
    List<PaiementClient> findAll();
    Optional<PaiementClient> findById(Long id);
    PaiementClient save(PaiementClient paiementClient);
    void deleteById(Long id);

    // list payments for ventes (by boutique id)
    List<PaiementClient> findByBoutiqueId(Long boutiqueId);

    // list payments for a specific commande client
    List<PaiementClient> findByCommandeClientId(Long commandeClientId);
}
