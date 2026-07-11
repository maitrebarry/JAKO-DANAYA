package com.smboutique.api.controller;

import com.smboutique.api.model.Permission;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.PermissionService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class AdminPermissionController {

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(AdminPermissionController.class);

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private PermissionService permissionService;

    @Autowired
    private com.smboutique.api.repository.UtilisateurRepository utilisateurRepository;

    private Utilisateur getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("Utilisateur authentifié introuvable");
        }
        return utilisateurService.findByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Utilisateur authentifié introuvable"));
    }

    private static final java.util.Set<String> OWNER_TIER_TYPES =
            new java.util.HashSet<>(java.util.Arrays.asList("PROPRIETAIRE", "ADMINISTRATEUR", "ADMIN", "OWNER"));
    private static final java.util.Set<String> MANAGER_TIER_TYPES =
            new java.util.HashSet<>(java.util.Arrays.asList("GERANT_BOUTIQUE", "GERANT", "GÉRANT", "MANAGER"));
    private static final java.util.Set<String> SUBORDINATE_TIER_TYPES =
            new java.util.HashSet<>(java.util.Arrays.asList(
                    "GERANT_BOUTIQUE", "GERANT", "GÉRANT", "MANAGER",
                    "MAGASINIER", "STOREKEEPER",
                    "CAISSIER", "CASHIER"));
    private static final java.util.Set<String> MANAGER_TARGET_TIER_TYPES =
            new java.util.HashSet<>(java.util.Arrays.asList("MAGASINIER", "STOREKEEPER", "CAISSIER", "CASHIER"));

    private java.util.Set<String> userTypeTokens(Utilisateur user) {
        java.util.Set<String> tokens = new java.util.HashSet<>();
        if (user == null) return tokens;
        if (user.getTypeUtilisateur() != null) tokens.add(user.getTypeUtilisateur().trim().toUpperCase());
        if (user.getRoles() != null) {
            user.getRoles().forEach(r -> {
                if (r.getName() != null) tokens.add(r.getName().trim().toUpperCase());
            });
        }
        return tokens;
    }

    private boolean hasAnyToken(java.util.Set<String> tokens, java.util.Set<String> candidates) {
        return tokens.stream().anyMatch(candidates::contains);
    }

    /**
     * Portée de gestion des permissions : le Superadmin gère tout le monde (sauf d'autres
     * Superadmins) ; le Propriétaire/Administrateur gère tous les subalternes de sa boutique
     * (Gérant/Magasinier/Caissier) ; un Gérant délégué (UTILISATEUR_GERER/CREER) ne gère que
     * les utilisateurs (Magasinier/Caissier) qu'il a lui-même créés.
     */
    private boolean canManagePermissionsFor(Utilisateur current, Utilisateur target) {
        if (current == null || target == null) return false;
        if (current.getId() != null && current.getId().equals(target.getId())) return false;

        if (isSuperAdmin(current)) {
            return !hasAnyToken(userTypeTokens(target), java.util.Collections.singleton("SUPERADMIN"));
        }

        boolean sameBoutique = current.getBoutique() != null && target.getBoutique() != null
                && current.getBoutique().getId() != null
                && current.getBoutique().getId().equals(target.getBoutique().getId());
        if (!sameBoutique) return false;

        java.util.Set<String> currentTokens = userTypeTokens(current);
        java.util.Set<String> targetTokens = userTypeTokens(target);

        if (hasAnyToken(currentTokens, OWNER_TIER_TYPES)) {
            return hasAnyToken(targetTokens, SUBORDINATE_TIER_TYPES);
        }

        if (hasAnyToken(currentTokens, MANAGER_TIER_TYPES)) {
            boolean isOwnCreation = target.getCreePar() != null && target.getCreePar().getId() != null
                    && target.getCreePar().getId().equals(current.getId());
            return isOwnCreation && hasAnyToken(targetTokens, MANAGER_TARGET_TIER_TYPES);
        }

        return false;
    }

    private boolean isSuperAdmin(Utilisateur user) {
        if (user == null) return false;
        // Determine superadmin by role membership only
        return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
    }

    @PreAuthorize("hasRole('SUPERADMIN') or hasAnyAuthority('UTILISATEUR_GERER','UTILISATEUR_CREER')")
    @GetMapping("/utilisateurs")
    public List<Utilisateur> listUsers() {
        Utilisateur current = getCurrentUser();
        if (isSuperAdmin(current)) {
            return utilisateurService.findAll();
        }
        if (current.getBoutique() == null) {
            return List.of();
        }
        return utilisateurService.findAllByBoutiqueId(current.getBoutique().getId());
    }

    @PreAuthorize("hasRole('SUPERADMIN') or hasAnyAuthority('UTILISATEUR_GERER','UTILISATEUR_CREER')")
    @GetMapping("/admin/permissions")
    public List<Permission> listPermissions() {
        return permissionService.findAll();
    }

    @PreAuthorize("hasRole('SUPERADMIN') or hasAnyAuthority('UTILISATEUR_GERER','UTILISATEUR_CREER')")
    @GetMapping("/admin/utilisateurs/{id}/permissions")
    public ResponseEntity<Set<Permission>> getUserPermissions(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        return utilisateurService.findById(id)
                .map(utilisateur -> {
                    if (!canManagePermissionsFor(current, utilisateur)) {
                        return ResponseEntity.status(403).<Set<Permission>>build();
                    }
                    // Combine direct permissions and role-inherited permissions so the UI can pre-check them
                    java.util.Set<Permission> combined = new java.util.HashSet<>();
                    if (utilisateur.getPermissions() != null) combined.addAll(utilisateur.getPermissions());
                    if (utilisateur.getRoles() != null) {
                        for (com.smboutique.api.model.Role r : utilisateur.getRoles()) {
                            if (r.getPermissions() != null) combined.addAll(r.getPermissions());
                        }
                    }
                    return ResponseEntity.ok(combined);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PreAuthorize("hasRole('SUPERADMIN') or hasAnyAuthority('UTILISATEUR_GERER','UTILISATEUR_CREER')")
    @PostMapping("/admin/utilisateurs/{id}/permissions")
    public ResponseEntity<?> updateUserPermissions(@PathVariable Long id, @RequestBody List<Long> permissionIds) {
        Utilisateur current = getCurrentUser();
        return utilisateurService.findById(id)
                .map(utilisateur -> {
                    if (!canManagePermissionsFor(current, utilisateur)) {
                        return ResponseEntity.status(403).build();
                    }
                    List<Long> ids = permissionIds == null ? List.of() : permissionIds;
                    Set<Permission> permissions = new HashSet<>(permissionService.findAllByIds(ids));
                    utilisateur.setPermissions(permissions);
                    Utilisateur saved = utilisateurService.save(utilisateur);
                    return ResponseEntity.ok(saved.getPermissions());
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
