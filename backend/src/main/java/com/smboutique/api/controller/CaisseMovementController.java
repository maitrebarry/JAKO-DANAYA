package com.smboutique.api.controller;

import com.smboutique.api.model.CaisseMovement;
import com.smboutique.api.service.CaisseMovementService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;

@RestController
@RequestMapping("/api/caisses")
@CrossOrigin(origins = "*")
public class CaisseMovementController {

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(CaisseMovementController.class);

    @Autowired
    private CaisseMovementService caisseMovementService;

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.repository.CaisseRepository caisseRepository;

    private boolean hasViewPermission() {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) return false;
        com.smboutique.api.model.Utilisateur user = utilisateurService.findByEmail(auth.getName()).orElse(null);
        if (user == null) return false;
        boolean isSuper = user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
        return isSuper || utilisateurService.hasPermission(user, "CAISSE_MOUVEMENT_VIEW");
    }

    @GetMapping("/{reference}/movements")
    public ResponseEntity<?> getMovementsForReference(@PathVariable String reference,
                                                      @RequestParam(required = false) String from,
                                                      @RequestParam(required = false) String to) {
        if (!hasViewPermission()) {
            return ResponseEntity.status(403).build();
        }

        // Enforce multi-boutique isolation: non-super users can only query movements for caisses belonging to their boutique
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        com.smboutique.api.model.Utilisateur user = null;
        try {
            if (auth != null && auth.getName() != null) {
                user = utilisateurService.findByEmail(auth.getName()).orElse(null);
            }
        } catch (Exception ex) {
            logger.warn("Unable to resolve current user: {}", ex.getMessage());
        }

        boolean isSuper = user != null && user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
        boolean hasGlobalView = isSuper || (user != null && utilisateurService.hasPermission(user, "CAISSE_MOUVEMENT_VIEW_ALL"));

        if (!hasGlobalView) {
            if (user == null || user.getBoutique() == null) {
                return ResponseEntity.status(403).body(java.util.Map.of("error", "Aucune boutique associée à votre compte"));
            }
            Long bId = user.getBoutique().getId();
            // Check that the reference belongs to this boutique
            java.util.Optional<com.smboutique.api.model.Caisse> maybe = caisseRepository.findFirstByReferenceAndBoutiqueIdOrderByIdDesc(reference, bId);
            if (maybe.isEmpty()) {
                logger.warn("User {} attempted to access movements for caisse reference {} which is not in their boutique {}", auth != null ? auth.getName() : "ANONYMOUS", reference, bId);
                return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé : la caisse demandée n'appartient pas à votre boutique"));
            }
        }

        // If the user doesn't have a global view, remember their boutique id so we can filter movements that might share the same reference across boutiques
        final Long currentBoutiqueId = (!hasGlobalView && user != null && user.getBoutique() != null) ? user.getBoutique().getId() : null;

        try {
            try {
                if (from != null && to != null) {
                    LocalDateTime f = LocalDateTime.parse(from);
                    LocalDateTime t = LocalDateTime.parse(to);
                    // Return enriched DTOs in date range
                    List<com.smboutique.api.dto.CaisseMovementDto> list = caisseMovementService.findDtoByReferenceCaisse(reference)
                            .stream()
                            .filter(d -> !d.getCreatedAt().isBefore(f) && !d.getCreatedAt().isAfter(t))
                            .filter(d -> hasGlobalView || (d.getBoutiqueId() != null && d.getBoutiqueId().equals(currentBoutiqueId)))
                            .toList();
                    return ResponseEntity.ok(list);
                }
            } catch (DateTimeParseException ex) {
                return ResponseEntity.badRequest().body(java.util.Map.of("error", "Dates invalides"));
            }

            List<com.smboutique.api.dto.CaisseMovementDto> list = caisseMovementService.findDtoByReferenceCaisse(reference)
                    .stream().filter(d -> hasGlobalView || (d.getBoutiqueId() != null && d.getBoutiqueId().equals(currentBoutiqueId))).toList();
            return ResponseEntity.ok(list);
        } catch (Exception ex) {
            logger.error("Failed to fetch movements for reference {}: {}", reference, ex.getMessage(), ex);
            return ResponseEntity.status(500).body(java.util.Map.of("error", "Erreur interne lors du chargement des mouvements", "message", ex.getMessage()));
        }
    }

    @GetMapping("/boutique/{boutiqueId}/movements")
    public ResponseEntity<?> getMovementsForBoutique(@PathVariable Long boutiqueId) {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        logger.info("getMovementsForBoutique called by: {} - boutiqueId={} ", auth != null ? auth.getName() : "ANONYMOUS", boutiqueId);
        try {
            if (!hasViewPermission()) {
                logger.warn("Unauthorized access attempt to movements for boutique {} by user {}", boutiqueId, auth != null ? auth.getName() : "ANONYMOUS");
                return ResponseEntity.status(403).build();
            }

            // Check boutique scoping: non-super users can only query their own boutique
            com.smboutique.api.model.Utilisateur user = null;
            if (auth != null && auth.getName() != null) {
                user = utilisateurService.findByEmail(auth.getName()).orElse(null);
            }
            boolean isSuper = user != null && user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
            boolean hasGlobalView = isSuper || (user != null && utilisateurService.hasPermission(user, "CAISSE_MOUVEMENT_VIEW_ALL"));
            if (!hasGlobalView) {
                if (user == null || user.getBoutique() == null || !user.getBoutique().getId().equals(boutiqueId)) {
                    logger.warn("User {} attempted to fetch movements for boutique {} but is not allowed", auth != null ? auth.getName() : "ANONYMOUS", boutiqueId);
                    return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé : vous ne pouvez pas consulter les mouvements d'autres boutiques."));
                }
            }

            List<com.smboutique.api.dto.CaisseMovementDto> list = caisseMovementService.findDtoByBoutiqueId(boutiqueId);
            return ResponseEntity.ok(list);
        } catch (Exception ex) {
            logger.error("Failed to fetch movements for boutique {}: {}", boutiqueId, ex.getMessage(), ex);
            return ResponseEntity.status(500).body(java.util.Map.of("error", "Erreur interne lors du chargement des mouvements", "message", ex.getMessage()));
        }
    }
}
