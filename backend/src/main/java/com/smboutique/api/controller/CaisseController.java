package com.smboutique.api.controller;

import com.smboutique.api.model.Caisse;
import com.smboutique.api.service.CaisseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/caisses")
@CrossOrigin(origins = "*")
public class CaisseController {

    @Autowired
    private CaisseService caisseService;

    @Autowired
    private com.smboutique.api.repository.CaisseRepository caisseRepository;

    @Autowired
    private com.smboutique.api.service.UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.service.CaisseMovementService caisseMovementService;

    private com.smboutique.api.model.Utilisateur getCurrentUser() {
        org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("Utilisateur authentifié introuvable");
        }
        return utilisateurService.findByEmail(authentication.getName()).orElseThrow(() -> new RuntimeException("Utilisateur authentifié introuvable"));
    }

    private boolean isSuperAdmin(com.smboutique.api.model.Utilisateur user) {
        if (user == null) return false;
        // Determine superadmin by role membership only
        return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
    }

    @GetMapping
    public List<Caisse> getAllCaisses() {
        return caisseService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Caisse> getCaisseById(@PathVariable Long id) {
        return caisseService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Caisse> createCaisse(@RequestBody Caisse caisse) {
        try {
            com.smboutique.api.model.Utilisateur current = getCurrentUser();
            // Allow creation if user is SUPERADMIN or has CAISSE_GERER or CAISSE_CREER permission
            if (!isSuperAdmin(current) && !utilisateurService.hasPermission(current, "CAISSE_GERER") && !utilisateurService.hasPermission(current, "CAISSE_CREER")) {
                return ResponseEntity.status(403).build();
            }
            if (caisse.getBoutique() == null || caisse.getBoutique().getId() == null) return ResponseEntity.badRequest().build();
            Long bid = caisse.getBoutique().getId();
            Integer max = caisseRepository.findMaxNumeroByBoutiqueId(bid);
            int next = (max == null) ? 1 : (max + 1);
            caisse.setNumero(next);

            // If reference not provided, generate server-side using numero
            java.time.LocalDate dt = caisse.getDateCaisse() != null ? caisse.getDateCaisse() : java.time.LocalDate.now();
            String month = String.format("%02d", dt.getMonthValue());
            String year = String.valueOf(dt.getYear());
            // Build a boutique-prefixed reference to avoid global collisions
            String boutiquePrefix = "";
            try {
                com.smboutique.api.model.Boutique b = caisse.getBoutique();
                if (b != null && b.getNom() != null) {
                    boutiquePrefix = b.getNom().replaceAll("[^A-Za-z0-9\\- ]", "").trim().replaceAll("\\s+", "-").toUpperCase();
                }
            } catch (Exception e) {}
            String initialRef = String.format("%s-CAISSE-%s-%s-N°%d", boutiquePrefix, month, year, next);
            String attemptRef = initialRef;
            int suffix = 1;
            // Ensure uniqueness within the boutique — append suffix if necessary
            while (caisseRepository.findFirstByReferenceAndBoutiqueIdOrderByIdDesc(attemptRef, bid).isPresent()) {
                attemptRef = initialRef + "-" + suffix;
                suffix++;
                if (suffix > 100) {
                    return ResponseEntity.status(500).body(null);
                }
            }
            caisse.setReference(attemptRef);

            Caisse saved = caisseService.save(caisse);
            // Record an OPEN movement if montantInitial / montantTotal > 0
            try {
                Integer before = 0;
                Integer after = saved.getMontantTotal() != null ? saved.getMontantTotal() : (saved.getMontantInitial() != null ? saved.getMontantInitial() : 0);
                if (after != null && after > 0) {
                    com.smboutique.api.model.CaisseMovement mv = new com.smboutique.api.model.CaisseMovement();
                    mv.setType(com.smboutique.api.model.CaisseMovement.MovementType.OPEN);
                    mv.setMontant(after);
                    mv.setBalanceBefore(before);
                    mv.setBalanceAfter(after);
                    mv.setReferenceCaisse(saved.getReference());
                    mv.setBoutiqueId(saved.getBoutique() != null ? saved.getBoutique().getId() : null);
                    mv.setRaison("Ouverture de caisse");
                    caisseMovementService.save(mv);
                }
            } catch (Exception mvex) { }
            return ResponseEntity.ok(saved);
        } catch (Exception ex) {
            return ResponseEntity.status(500).build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Caisse> updateCaisse(@PathVariable Long id, @RequestBody Caisse caisseDetails) {
        com.smboutique.api.model.Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && !utilisateurService.hasPermission(current, "CAISSE_GERER")) {
            return ResponseEntity.status(403).build();
        }
        return caisseService.findById(id)
                .map(caisse -> {
                    caisse.setDateCaisse(caisseDetails.getDateCaisse());
                    caisse.setMontantInitial(caisseDetails.getMontantInitial());
                    caisse.setStatut(caisseDetails.getStatut());
                    caisse.setReference(caisseDetails.getReference());
                    Integer before = caisse.getMontantTotal() != null ? caisse.getMontantTotal() : 0;
                    caisse.setMontantTotal(caisseDetails.getMontantTotal());
                    com.smboutique.api.model.Caisse saved = caisseService.save(caisse);

                    try {
                        Integer after = saved.getMontantTotal() != null ? saved.getMontantTotal() : 0;
                        if (!before.equals(after)) {
                            com.smboutique.api.model.CaisseMovement mv = new com.smboutique.api.model.CaisseMovement();
                            mv.setType(com.smboutique.api.model.CaisseMovement.MovementType.AJUSTEMENT);
                            mv.setMontant(Math.abs(after - before));
                            mv.setBalanceBefore(before);
                            mv.setBalanceAfter(after);
                            mv.setReferenceCaisse(saved.getReference());
                            mv.setBoutiqueId(saved.getBoutique() != null ? saved.getBoutique().getId() : null);
                            mv.setRaison("Mise à jour manuelle caisse");
                            caisseMovementService.save(mv);
                        }
                    } catch (Exception mvex) {}

                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCaisse(@PathVariable Long id) {
        com.smboutique.api.model.Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && !utilisateurService.hasPermission(current, "CAISSE_GERER")) {
            return ResponseEntity.status(403).build();
        }
        return caisseService.findById(id)
                .map(caisse -> {
                    caisseService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
