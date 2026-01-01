package com.smboutique.api.controller;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.Unite;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.BoutiqueService;
import com.smboutique.api.service.UniteService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/unites")
@CrossOrigin(origins = "*")
public class UniteController {

    @Autowired
    private UniteService uniteService;

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private BoutiqueService boutiqueService;

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
    public List<Unite> getAllUnites() {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "PRODUIT_LECTURE")) {
            return List.of(); // Return empty list if no permission
        }
        if (isSuperAdmin(current)) {
            return uniteService.findAll();
        }
        if (current.getBoutique() == null) {
            return List.of();
        }
        return uniteService.findAllByBoutiqueId(current.getBoutique().getId());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Unite> getUniteById(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        Optional<Unite> uniteOpt = isSuperAdmin(current)
                ? uniteService.findById(id)
                : (current.getBoutique() == null ? Optional.empty() : uniteService.findByIdAndBoutiqueId(id, current.getBoutique().getId()));

        return uniteOpt
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Unite createUnite(@RequestBody Unite unite) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "PRODUIT_CREER")) {
            throw new RuntimeException("Permission manquante : PRODUIT_CREER");
        }
        if (!isSuperAdmin(current)) {
            unite.setBoutique(current.getBoutique());
        } else if (unite.getBoutique() != null && unite.getBoutique().getId() != null) {
            Boutique boutique = boutiqueService.findById(unite.getBoutique().getId())
                    .orElseThrow(() -> new IllegalArgumentException("Boutique non trouvée"));
            unite.setBoutique(boutique);
        }
        return uniteService.save(unite);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Unite> updateUnite(@PathVariable Long id, @RequestBody Unite uniteDetails) {
        Utilisateur current = getCurrentUser();
        Optional<Unite> uniteOpt = isSuperAdmin(current)
                ? uniteService.findById(id)
                : (current.getBoutique() == null ? Optional.empty() : uniteService.findByIdAndBoutiqueId(id, current.getBoutique().getId()));

        return uniteOpt
                .map(unite -> {
                    if (isSuperAdmin(current)) {
                        if (uniteDetails.getBoutique() != null && uniteDetails.getBoutique().getId() != null) {
                            Boutique boutique = boutiqueService.findById(uniteDetails.getBoutique().getId())
                                    .orElseThrow(() -> new IllegalArgumentException("Boutique non trouvée"));
                            unite.setBoutique(boutique);
                        }
                    } else if (current.getBoutique() != null) {
                        unite.setBoutique(current.getBoutique());
                    }
                    unite.setLibelle(uniteDetails.getLibelle());
                    unite.setSymbole(uniteDetails.getSymbole());
                    return ResponseEntity.ok(uniteService.save(unite));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUnite(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        Optional<Unite> uniteOpt = isSuperAdmin(current)
                ? uniteService.findById(id)
                : (current.getBoutique() == null ? Optional.empty() : uniteService.findByIdAndBoutiqueId(id, current.getBoutique().getId()));

        return uniteOpt
                .map(unite -> {
                    uniteService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
