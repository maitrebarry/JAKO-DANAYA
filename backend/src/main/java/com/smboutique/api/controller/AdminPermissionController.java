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

    private java.util.Map<String, Object> permissionDto(Permission permission) {
        java.util.Map<String, Object> dto = new java.util.LinkedHashMap<>();
        dto.put("id", permission.getId());
        dto.put("name", permission.getName());
        dto.put("description", permission.getDescription());
        return dto;
    }

    private java.util.Map<String, Object> userDto(Utilisateur utilisateur) {
        java.util.Map<String, Object> dto = new java.util.LinkedHashMap<>();
        dto.put("id", utilisateur.getId());
        dto.put("nom", utilisateur.getNom());
        dto.put("prenom", utilisateur.getPrenom());
        dto.put("email", utilisateur.getEmail());
        dto.put("pseudo", utilisateur.getPseudo());
        dto.put("typeUtilisateur", utilisateur.getTypeUtilisateur());
        dto.put("statut", utilisateur.getStatut());

        if (utilisateur.getBoutique() != null) {
            java.util.Map<String, Object> boutique = new java.util.LinkedHashMap<>();
            boutique.put("id", utilisateur.getBoutique().getId());
            boutique.put("nom", utilisateur.getBoutique().getNom());
            dto.put("boutique", boutique);
        } else {
            dto.put("boutique", null);
        }

        if (utilisateur.getCreePar() != null) {
            java.util.Map<String, Object> creePar = new java.util.LinkedHashMap<>();
            creePar.put("id", utilisateur.getCreePar().getId());
            dto.put("creePar", creePar);
        } else {
            dto.put("creePar", null);
        }

        java.util.List<java.util.Map<String, Object>> roles = new java.util.ArrayList<>();
        if (utilisateur.getRoles() != null) {
            utilisateur.getRoles().forEach(role -> {
                java.util.Map<String, Object> roleDto = new java.util.LinkedHashMap<>();
                roleDto.put("id", role.getId());
                roleDto.put("name", role.getName());
                roles.add(roleDto);
            });
        }
        dto.put("roles", roles);
        return dto;
    }

    @PreAuthorize("hasRole('SUPERADMIN') or hasAnyAuthority('UTILISATEUR_GERER','UTILISATEUR_CREER')")
    @GetMapping("/utilisateurs")
    public List<java.util.Map<String, Object>> listUsers() {
        Utilisateur current = getCurrentUser();
        List<Utilisateur> users;
        if (isSuperAdmin(current)) {
            users = utilisateurService.findAll();
        } else if (current.getBoutique() != null) {
            users = utilisateurService.findAllByBoutiqueId(current.getBoutique().getId());
        } else {
            users = List.of();
        }

        return users.stream()
                .filter(target -> canManagePermissionsFor(current, target))
                .map(this::userDto)
                .toList();
    }

    @PreAuthorize("hasRole('SUPERADMIN') or hasAnyAuthority('UTILISATEUR_GERER','UTILISATEUR_CREER')")
    @GetMapping("/admin/permissions")
    public List<java.util.Map<String, Object>> listPermissions() {
        return permissionService.findAll().stream()
                .map(this::permissionDto)
                .toList();
    }

    @PreAuthorize("hasRole('SUPERADMIN') or hasAnyAuthority('UTILISATEUR_GERER','UTILISATEUR_CREER')")
    @GetMapping("/admin/utilisateurs/{id}/permissions")
    public ResponseEntity<List<java.util.Map<String, Object>>> getUserPermissions(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        return utilisateurService.findById(id)
                .map(utilisateur -> {
                    if (!canManagePermissionsFor(current, utilisateur)) {
                        return ResponseEntity.status(403).<List<java.util.Map<String, Object>>>build();
                    }
                    // Combine direct permissions and role-inherited permissions so the UI can pre-check them
                    java.util.Set<Permission> combined = new java.util.HashSet<>();
                    if (utilisateur.getPermissions() != null) combined.addAll(utilisateur.getPermissions());
                    if (utilisateur.getRoles() != null) {
                        for (com.smboutique.api.model.Role r : utilisateur.getRoles()) {
                            if (r.getPermissions() != null) combined.addAll(r.getPermissions());
                        }
                    }
                    return ResponseEntity.ok(combined.stream()
                            .map(this::permissionDto)
                            .toList());
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
                    return ResponseEntity.ok(saved.getPermissions().stream()
                            .map(this::permissionDto)
                            .toList());
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
