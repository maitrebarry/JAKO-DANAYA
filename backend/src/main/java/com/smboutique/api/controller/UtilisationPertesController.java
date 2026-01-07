package com.smboutique.api.controller;

import com.smboutique.api.model.UtilisationPertes;
import com.smboutique.api.service.UtilisationPertesService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/utilisation-pertes")
@CrossOrigin(origins = "*")
public class UtilisationPertesController {

    @Autowired
    private UtilisationPertesService utilisationPertesService;

    @Autowired
    private com.smboutique.api.service.UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.service.MouvementService mouvementService;

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
    public List<UtilisationPertes> getAllUtilisationPertes() {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "UTILISA_PERTE_VOIR")) {
            throw new org.springframework.security.access.AccessDeniedException("Permission requise: UTILISA_PERTE_VOIR");
        }
        return utilisationPertesService.findAll();
    }

    @GetMapping("/mouvement/{mouvementId}")
    public ResponseEntity<UtilisationPertes> getByMouvementId(@PathVariable Long mouvementId) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "UTILISA_PERTE_VOIR")) {
            return ResponseEntity.<UtilisationPertes>status(403).body(null);
        }
        return utilisationPertesService.findByMouvementId(mouvementId).map(ResponseEntity::ok).orElse(ResponseEntity.<UtilisationPertes>notFound().build());
    }

    @GetMapping("/{id}")
    public ResponseEntity<UtilisationPertes> getUtilisationPertesById(@PathVariable Long id) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "UTILISA_PERTE_VOIR")) {
            return ResponseEntity.<UtilisationPertes>status(403).body(null);
        }
        return utilisationPertesService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.<UtilisationPertes>notFound().build());
    }

    @PostMapping
    public ResponseEntity<UtilisationPertes> createUtilisationPertes(@RequestBody UtilisationPertes utilisationPertes) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "UTILISA_PERTE_CREER")) {
            return ResponseEntity.<UtilisationPertes>status(403).body(null);
        }
        // determine boutique for this utilisation_pertes
        if (utilisationPertes.getBoutique() == null) {
            utilisationPertes.setBoutique(user.getBoutique());
        }
        try {
            com.smboutique.api.model.Mouvement mv = mouvementService.createUtilisationFromUtilisationPertes(utilisationPertes, user);
            // refresh utilisationPertes with mouvementId
            java.util.Optional<UtilisationPertes> savedOpt = utilisationPertesService.findByMouvementId(mv.getId());
            if (savedOpt.isPresent()) return ResponseEntity.ok(savedOpt.get());
            return ResponseEntity.ok(utilisationPertesService.save(utilisationPertes));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.<UtilisationPertes>badRequest().body(null);
        } catch (Exception ex) {
            return ResponseEntity.<UtilisationPertes>status(500).body(null);
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<UtilisationPertes> updateUtilisationPertes(@PathVariable Long id, @RequestBody UtilisationPertes utilisationPertesDetails) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "UTILISA_PERTE_MODIFIER")) {
            return ResponseEntity.<UtilisationPertes>status(403).body(null);
        }
        java.util.Optional<UtilisationPertes> opt = utilisationPertesService.findById(id);
        if (opt.isEmpty()) return ResponseEntity.<UtilisationPertes>notFound().build();
        UtilisationPertes utilisationPertes = opt.get();
        utilisationPertes.setMotif(utilisationPertesDetails.getMotif());
        utilisationPertes.setQuantite(utilisationPertesDetails.getQuantite());
        utilisationPertes.setDate(utilisationPertesDetails.getDate());
        utilisationPertes.setType(utilisationPertesDetails.getType());
        utilisationPertes.setProduit(utilisationPertesDetails.getProduit());
        if (utilisationPertesDetails.getBoutique() != null) utilisationPertes.setBoutique(utilisationPertesDetails.getBoutique());
        if (utilisationPertesDetails.getMagasin() != null) utilisationPertes.setMagasin(utilisationPertesDetails.getMagasin());

        // persist utilisationPertes first to have latest data
        UtilisationPertes saved = utilisationPertesService.save(utilisationPertes);

        try {
            if (saved.getMouvementId() != null) {
                // build mouvement details and delegate update
                com.smboutique.api.model.Mouvement mvDetails = new com.smboutique.api.model.Mouvement();
                mvDetails.setProduit(saved.getProduit());
                mvDetails.setQuantite(saved.getQuantite());
                mvDetails.setDescription(saved.getMotif());
                mvDetails.setSousType(saved.getType());
                mvDetails.setDateMouvement(saved.getDate() != null ? saved.getDate().atStartOfDay() : null);
                // call update
                mouvementService.updateUtilisation(saved.getMouvementId(), mvDetails, user);
            } else {
                // create mouvement from this utilisation_pertes
                com.smboutique.api.model.Mouvement mv = mouvementService.createUtilisationFromUtilisationPertes(saved, user);
                saved = utilisationPertesService.findByMouvementId(mv.getId()).orElse(saved);
            }
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.<UtilisationPertes>badRequest().body(null);
        } catch (Exception ex) {
            return ResponseEntity.<UtilisationPertes>status(500).body(null);
        }

        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUtilisationPertes(@PathVariable Long id) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "UTILISA_PERTE_SUPPRIMER")) {
            return ResponseEntity.<Void>status(403).build();
        }
        java.util.Optional<UtilisationPertes> opt = utilisationPertesService.findById(id);
        if (opt.isEmpty()) return ResponseEntity.<Void>notFound().build();
        UtilisationPertes utilisationPertes = opt.get();
        try {
            if (utilisationPertes.getMouvementId() != null) {
                mouvementService.deleteById(utilisationPertes.getMouvementId());
            }
            utilisationPertesService.deleteById(id);
            return ResponseEntity.ok().<Void>build();
        } catch (Exception ex) {
            return ResponseEntity.<Void>status(500).build();
        }
    }
}
