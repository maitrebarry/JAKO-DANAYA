package com.smboutique.api.service;

import com.smboutique.api.model.Reception;
import com.smboutique.api.dto.ReceptionListDTO;
import java.util.List;
import java.util.Optional;

public interface ReceptionService {
    List<Reception> findAll();
    List<Reception> findUnfinishedReceptions();
    List<Reception> findFinishedReceptions();
    List<ReceptionListDTO> findAllReceptionsList();
    List<ReceptionListDTO> findUnfinishedReceptionsList();
    List<ReceptionListDTO> findFinishedReceptionsList();

    // Méthodes filtrées par boutique
    List<Reception> findUnfinishedReceptionsByBoutiqueId(Long boutiqueId);
    List<Reception> findFinishedReceptionsByBoutiqueId(Long boutiqueId);
    List<ReceptionListDTO> findUnfinishedReceptionsListByBoutiqueId(Long boutiqueId);
    List<ReceptionListDTO> findFinishedReceptionsListByBoutiqueId(Long boutiqueId);

    // New helpers
    boolean isReceptionUnfinished(Long receptionId);
    java.util.List<com.smboutique.api.dto.ReceptionStatusDTO> getReceptionsStatusByBoutique(Long boutiqueId);

    Optional<Reception> findById(Long id);
    Reception save(Reception reception);
    void deleteById(Long id);

    // Find receptions for a given commande
    java.util.List<Reception> findByCommandeFournisseurId(Long commandeId);
}
