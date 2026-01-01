package com.smboutique.api.controller;

import com.smboutique.api.model.Magasin;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.MagasinService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/magasins")
@CrossOrigin(origins = "*")
public class MagasinController {

    @Autowired
    private MagasinService magasinService;

    @Autowired
    private UtilisateurService utilisateurService;

    private Utilisateur getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
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

    private boolean hasPermission(Utilisateur user, String permissionName) {
        if (user == null) return false;
        return user.getPermissions().stream().anyMatch(p -> p.getName().equals(permissionName));
    }

    @GetMapping
    public List<Magasin> getAllMagasins() {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "INVENTAIRE_LECTURE")) {
            return List.of(); // Return empty list if no permission
        }
        if (isSuperAdmin(current)) {
            return magasinService.findAll();
        }
        if (current.getBoutique() == null) {
            return List.of();
        }
        return magasinService.findAllByBoutiqueId(current.getBoutique().getId());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Magasin> getMagasinById(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "INVENTAIRE_LECTURE")) {
            return ResponseEntity.status(403).build();
        }
        return magasinService.findById(id)
                .map(magasin -> {
                    if (!isSuperAdmin(current)) {
                        if (current.getBoutique() == null || magasin.getBoutique() == null || !current.getBoutique().getId().equals(magasin.getBoutique().getId())) {
                            return ResponseEntity.status(403).<Magasin>build();
                        }
                    }
                    return ResponseEntity.ok(magasin);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Magasin createMagasin(@RequestBody Magasin magasin) {
        Utilisateur current = getCurrentUser();
        // allow SUPERADMIN users (by role or type) to bypass explicit permission checks
        if (!isSuperAdmin(current) && !hasPermission(current, "INVENTAIRE_CREER")) {
            throw new RuntimeException("Permission manquante : INVENTAIRE_CREER");
        }
        if (!isSuperAdmin(current)) {
            magasin.setBoutique(current.getBoutique());
        }
        return magasinService.save(magasin);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Magasin> updateMagasin(@PathVariable Long id, @RequestBody Magasin magasinDetails) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "INVENTAIRE_MODIFIER")) {
            return ResponseEntity.status(403).build();
        }
        return magasinService.findById(id)
                .map(magasin -> {
                    if (!isSuperAdmin(current)) {
                        if (current.getBoutique() == null || magasin.getBoutique() == null || !current.getBoutique().getId().equals(magasin.getBoutique().getId())) {
                            return ResponseEntity.status(403).<Magasin>build();
                        }
                        magasin.setBoutique(current.getBoutique());
                    } else {
                        magasin.setBoutique(magasinDetails.getBoutique());
                    }
                    magasin.setNom(magasinDetails.getNom());
                    magasin.setAdresse(magasinDetails.getAdresse());
                    magasin.setTypeMagasin(magasinDetails.getTypeMagasin());
                    return ResponseEntity.ok(magasinService.save(magasin));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMagasin(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "INVENTAIRE_SUPPRIMER")) {
            return ResponseEntity.status(403).build();
        }
        return magasinService.findById(id)
                .map(magasin -> {
                    if (!isSuperAdmin(current)) {
                        if (current.getBoutique() == null || magasin.getBoutique() == null || !current.getBoutique().getId().equals(magasin.getBoutique().getId())) {
                            return ResponseEntity.status(403).<Void>build();
                        }
                    }
                    magasinService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}