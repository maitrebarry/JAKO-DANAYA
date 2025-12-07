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

    Optional<Reception> findById(Long id);
    Reception save(Reception reception);
    void deleteById(Long id);
}
