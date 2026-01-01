package com.smboutique.api.service;

import com.smboutique.api.dto.CaisseMovementDto;
import com.smboutique.api.model.CaisseMovement;
import java.time.LocalDateTime;
import java.util.List;

public interface CaisseMovementService {
    CaisseMovement save(CaisseMovement movement);
    List<CaisseMovement> findByReferenceCaisse(String referenceCaisse);
    List<CaisseMovement> findByReferenceCaisseBetween(String referenceCaisse, LocalDateTime from, LocalDateTime to);
    List<CaisseMovement> findByBoutiqueId(Long boutiqueId);

    // enriched DTO results including related references (commande, paiement, utilisateur)
    List<CaisseMovementDto> findDtoByReferenceCaisse(String referenceCaisse);
    List<CaisseMovementDto> findDtoByBoutiqueId(Long boutiqueId);
}
