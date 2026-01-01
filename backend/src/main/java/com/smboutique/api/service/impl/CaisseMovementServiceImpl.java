package com.smboutique.api.service.impl;

import com.smboutique.api.model.CaisseMovement;
import com.smboutique.api.dto.CaisseMovementDto;
import com.smboutique.api.model.CaisseMovement;
import com.smboutique.api.repository.CaisseMovementRepository;
import com.smboutique.api.service.CaisseMovementService;
import com.smboutique.api.service.CommandeClientService;
import com.smboutique.api.service.PaiementClientService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class CaisseMovementServiceImpl implements CaisseMovementService {

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(CaisseMovementServiceImpl.class);

    @Autowired
    private CaisseMovementRepository repository;

    @Autowired
    private CommandeClientService commandeClientService;

    @Autowired
    private PaiementClientService paiementClientService;

    @Autowired
    private UtilisateurService utilisateurService;

    @Override
    public CaisseMovement save(CaisseMovement movement) {
        return repository.save(movement);
    }

    @Override
    public List<CaisseMovement> findByReferenceCaisse(String referenceCaisse) {
        return repository.findByReferenceCaisseOrderByCreatedAtDesc(referenceCaisse);
    }

    @Override
    public List<CaisseMovement> findByReferenceCaisseBetween(String referenceCaisse, LocalDateTime from, LocalDateTime to) {
        return repository.findByReferenceCaisseAndCreatedAtBetweenOrderByCreatedAtDesc(referenceCaisse, from, to);
    }

    @Override
    public List<CaisseMovement> findByBoutiqueId(Long boutiqueId) {
        return repository.findByBoutiqueIdOrderByCreatedAtDesc(boutiqueId);
    }

    @Override
    public List<CaisseMovementDto> findDtoByReferenceCaisse(String referenceCaisse) {
        List<CaisseMovement> list = findByReferenceCaisse(referenceCaisse);
        List<CaisseMovementDto> out = new ArrayList<>();
        for (CaisseMovement cm : list) {
            CaisseMovementDto dto = new CaisseMovementDto(cm);

            if (cm.getCommandeId() != null) {
                commandeClientService.findById(cm.getCommandeId()).ifPresentOrElse(c -> {
                    dto.setCommandeReference(c.getReference());
                    logger.debug("Enriched movement id={} with commande id={} reference={}", cm.getId(), cm.getCommandeId(), c.getReference());
                }, () -> logger.debug("No commande found for id {} while enriching movement id={}", cm.getCommandeId(), cm.getId()));
            }
            if (cm.getPaiementId() != null) {
                // If this paiementId belongs to a PaiementClient (client payment), mark as Entree CMC
                if (paiementClientService.findById(cm.getPaiementId()).isPresent()) {
                    dto.setTypeLabel("Entree CMC");
                    paiementClientService.findById(cm.getPaiementId()).ifPresent(p -> dto.setPaiementReference(p.getReference()));
                    logger.debug("Enriched movement id={} with paiement-client id={} reference={} and label=Entree CMC", cm.getId(), cm.getPaiementId(), dto.getPaiementReference());
                } else {
                    paiementClientService.findById(cm.getPaiementId()).ifPresentOrElse(p -> {
                        dto.setPaiementReference(p.getReference());
                        logger.debug("Enriched movement id={} with paiement id={} reference={}", cm.getId(), cm.getPaiementId(), p.getReference());
                    }, () -> logger.debug("No paiement found for id {} while enriching movement id={}", cm.getPaiementId(), cm.getId()));
                }
            }
            if (cm.getUserId() != null) {
                utilisateurService.findById(cm.getUserId()).ifPresentOrElse(u -> {
                    String full = (u.getNom()!=null?u.getNom():"") + " " + (u.getPrenom()!=null?u.getPrenom():"");
                    dto.setUserFullName(full.trim());
                    logger.debug("Enriched movement id={} with user id={} name={}", cm.getId(), cm.getUserId(), full.trim());
                }, () -> logger.debug("No user found for id {} while enriching movement id={}", cm.getUserId(), cm.getId()));
            }

            // Compute human-friendly type label
            if (cm.getType() == com.smboutique.api.model.CaisseMovement.MovementType.CREDIT) {
                if (dto.getTypeLabel() == null || dto.getTypeLabel().isEmpty()) {
                    // If metadata indicates a direct sale (future feature), show ENTREE-VTE-DIRECT
                    if (cm.getMetadata() != null && cm.getMetadata().toLowerCase().contains("vente-direct")) {
                        dto.setTypeLabel("ENTREE-VTE-DIRECT");
                    } else {
                        dto.setTypeLabel("CREDIT");
                    }
                }
            } else if (cm.getType() == com.smboutique.api.model.CaisseMovement.MovementType.DEPENSE) {
                dto.setTypeLabel("SORTIE-DEPENSE");
            }

            out.add(dto);
        }
        return out;
    }

    @Override
    public List<CaisseMovementDto> findDtoByBoutiqueId(Long boutiqueId) {
        List<CaisseMovement> list = findByBoutiqueId(boutiqueId);
        List<CaisseMovementDto> out = new ArrayList<>();
        for (CaisseMovement cm : list) {
            CaisseMovementDto dto = new CaisseMovementDto(cm);

            if (cm.getCommandeId() != null) {
                commandeClientService.findById(cm.getCommandeId()).ifPresentOrElse(c -> {
                    dto.setCommandeReference(c.getReference());
                    logger.debug("Enriched movement id={} with commande id={} reference={}", cm.getId(), cm.getCommandeId(), c.getReference());
                }, () -> logger.debug("No commande found for id {} while enriching movement id={}", cm.getCommandeId(), cm.getId()));
            }
            if (cm.getPaiementId() != null) {
                // If this paiementId belongs to a PaiementClient (client payment), mark as Entree CMC
                if (paiementClientService.findById(cm.getPaiementId()).isPresent()) {
                    dto.setTypeLabel("Entree CMC");
                    paiementClientService.findById(cm.getPaiementId()).ifPresent(p -> dto.setPaiementReference(p.getReference()));
                    logger.debug("Enriched movement id={} with paiement-client id={} reference={} and label=Entree CMC", cm.getId(), cm.getPaiementId(), dto.getPaiementReference());
                } else {
                    paiementClientService.findById(cm.getPaiementId()).ifPresentOrElse(p -> {
                        dto.setPaiementReference(p.getReference());
                        logger.debug("Enriched movement id={} with paiement id={} reference={}", cm.getId(), cm.getPaiementId(), p.getReference());
                    }, () -> logger.debug("No paiement found for id {} while enriching movement id={}", cm.getPaiementId(), cm.getId()));
                }
            }
            if (cm.getUserId() != null) {
                utilisateurService.findById(cm.getUserId()).ifPresentOrElse(u -> {
                    String full = (u.getNom()!=null?u.getNom():"") + " " + (u.getPrenom()!=null?u.getPrenom():"");
                    dto.setUserFullName(full.trim());
                    logger.debug("Enriched movement id={} with user id={} name={}", cm.getId(), cm.getUserId(), full.trim());
                }, () -> logger.debug("No user found for id {} while enriching movement id={}", cm.getUserId(), cm.getId()));
            }

            // Compute human-friendly type label
            if (cm.getType() == com.smboutique.api.model.CaisseMovement.MovementType.CREDIT) {
                if (dto.getTypeLabel() == null || dto.getTypeLabel().isEmpty()) {
                    // If metadata indicates a direct sale (future feature), show ENTREE-VTE-DIRECT
                    if (cm.getMetadata() != null && cm.getMetadata().toLowerCase().contains("vente-direct")) {
                        dto.setTypeLabel("ENTREE-VTE-DIRECT");
                    } else {
                        dto.setTypeLabel("CREDIT");
                    }
                }
            } else if (cm.getType() == com.smboutique.api.model.CaisseMovement.MovementType.DEPENSE) {
                dto.setTypeLabel("SORTIE-DEPENSE");
            }

            out.add(dto);
        }
        return out;
    }
}
