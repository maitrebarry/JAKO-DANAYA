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
        return utilisationPertesService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<UtilisationPertes> getUtilisationPertesById(@PathVariable Long id) {
        return utilisationPertesService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<UtilisationPertes> createUtilisationPertes(@RequestBody UtilisationPertes utilisationPertes) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "PRODUIT_PERTE")) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(utilisationPertesService.save(utilisationPertes));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UtilisationPertes> updateUtilisationPertes(@PathVariable Long id, @RequestBody UtilisationPertes utilisationPertesDetails) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "PRODUIT_PERTE")) {
            return ResponseEntity.status(403).build();
        }
        return utilisationPertesService.findById(id)
                .map(utilisationPertes -> {
                    utilisationPertes.setMotif(utilisationPertesDetails.getMotif());
                    utilisationPertes.setQuantite(utilisationPertesDetails.getQuantite());
                    utilisationPertes.setDate(utilisationPertesDetails.getDate());
                    utilisationPertes.setType(utilisationPertesDetails.getType());
                    utilisationPertes.setProduit(utilisationPertesDetails.getProduit());
                    return ResponseEntity.ok(utilisationPertesService.save(utilisationPertes));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUtilisationPertes(@PathVariable Long id) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "PRODUIT_PERTE")) {
            return ResponseEntity.status(403).build();
        }
        return utilisationPertesService.findById(id)
                .map(utilisationPertes -> {
                    utilisationPertesService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
