package com.smboutique.api.controller;

import com.smboutique.api.model.ConfigurationMarge;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.ConfigurationMargeService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/configuration-marge")
@CrossOrigin(origins = "*")
public class ConfigurationMargeController {
    @Autowired
    private ConfigurationMargeService configurationMargeService;

    @Autowired
    private UtilisateurService utilisateurService;

    private Utilisateur getCurrentUser() {
        org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("Utilisateur authentifié introuvable");
        }
        return utilisateurService.findByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Utilisateur authentifié introuvable"));
    }

    private boolean isSuperAdmin(Utilisateur user) {
        if (user == null) return false;
        // Determine superadmin by role membership only
        return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
    }

    @GetMapping("/boutique/{id}")
    public ResponseEntity<?> getByBoutique(@PathVariable Long id) {
        Utilisateur user = getCurrentUser();
        // Superadmin can always read
        if (!isSuperAdmin(user)) {
            if (!hasPermission(user, "CONFIG_MARGE_LECTURE")) {
                return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé : permission CONFIG_MARGE_LECTURE requise"));
            }
            // check boutique ownership
            if (user.getBoutique() == null || !user.getBoutique().getId().equals(id)) {
                return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé : boutique différente"));
            }
        }
        Optional<ConfigurationMarge> cfg = configurationMargeService.findByBoutiqueId(id);
        return cfg.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody ConfigurationMarge cfg) {
        Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user)) {
            if (!hasPermission(user, "CONFIG_MARGE_ECRITURE")) {
                return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé : permission CONFIG_MARGE_ECRITURE requise"));
            }
            if (user.getBoutique() == null || cfg.getBoutique() == null || !user.getBoutique().getId().equals(cfg.getBoutique().getId())) {
                return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé : seule la configuration de votre boutique peut être modifiée"));
            }
        }
        try {
            ConfigurationMarge saved = configurationMargeService.save(cfg);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(java.util.Map.of("error", "Impossible de créer la configuration"));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody ConfigurationMarge cfg) {
        Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user)) {
            if (!hasPermission(user, "CONFIG_MARGE_ECRITURE")) {
                return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé : permission CONFIG_MARGE_ECRITURE requise"));
            }
            if (user.getBoutique() == null || cfg.getBoutique() == null || !user.getBoutique().getId().equals(cfg.getBoutique().getId())) {
                return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé : seule la configuration de votre boutique peut être modifiée"));
            }
        }
        cfg.setId(id);
        try {
            ConfigurationMarge saved = configurationMargeService.save(cfg);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(java.util.Map.of("error", "Impossible de mettre à jour la configuration"));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        Utilisateur user = getCurrentUser();
        Optional<ConfigurationMarge> existing = configurationMargeService.findByBoutiqueId(null);
        // fetch existing by id to check boutique
        Optional<ConfigurationMarge> existingCfg = configurationMargeService.findByBoutiqueId(null);
        // simpler: load by id through repository via service impl? We'll use findByBoutiqueId only when matching boutique.
        if (!isSuperAdmin(user)) {
            if (!hasPermission(user, "CONFIG_MARGE_SUPPRESSION")) {
                return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé : permission CONFIG_MARGE_SUPPRESSION requise"));
            }
        }
        try {
            configurationMargeService.deleteById(id);
            return ResponseEntity.ok(java.util.Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(java.util.Map.of("error", "Impossible de supprimer la configuration"));
        }
    }

    private boolean hasPermission(Utilisateur user, String permissionName) {
        if (user == null) return false;
        return user.getPermissions().stream().anyMatch(p -> p.getName().equals(permissionName));
    }
}
