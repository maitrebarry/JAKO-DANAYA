package com.smboutique.api.controller;

import com.smboutique.api.model.Inventaire;
import com.smboutique.api.service.InventaireService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/inventaires")
@CrossOrigin(origins = "*")
public class InventaireController {

    @Autowired
    private InventaireService inventaireService;

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
    public List<Inventaire> getAllInventaires() {
        return inventaireService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Inventaire> getInventaireById(@PathVariable Long id) {
        return inventaireService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Inventaire> createInventaire(@RequestBody Inventaire inventaire) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "INVENTAIRE_CREER")) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(inventaireService.save(inventaire));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Inventaire> updateInventaire(@PathVariable Long id, @RequestBody Inventaire inventaireDetails) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "INVENTAIRE_MODIFIER")) {
            return ResponseEntity.status(403).build();
        }
        return inventaireService.findById(id)
                .map(inventaire -> {
                    inventaire.setReference(inventaireDetails.getReference());
                    inventaire.setDateInventaire(inventaireDetails.getDateInventaire());
                    return ResponseEntity.ok(inventaireService.save(inventaire));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteInventaire(@PathVariable Long id) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "INVENTAIRE_SUPPRIMER")) {
            return ResponseEntity.status(403).build();
        }
        return inventaireService.findById(id)
                .map(inventaire -> {
                    inventaireService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
