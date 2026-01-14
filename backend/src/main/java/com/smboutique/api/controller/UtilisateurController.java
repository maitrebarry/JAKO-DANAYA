package com.smboutique.api.controller;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.BoutiqueService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
public class UtilisateurController {

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(UtilisateurController.class);

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private BoutiqueService boutiqueService;

    @Autowired
    private com.smboutique.api.service.PhoneService phoneService;

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

    private boolean sameBoutique(Utilisateur user, Boutique boutique) {
        if (user == null || user.getBoutique() == null || boutique == null) return false;
        return user.getBoutique().getId() != null && user.getBoutique().getId().equals(boutique.getId());
    }

    /**
     * Compute set of role names that the current user must not be able to assign to others.
     * - SUPERADMIN can't assign SUPERADMIN
     * - ADMIN can't assign SUPERADMIN or ADMIN
     * - MANAGER can't assign SUPERADMIN, ADMIN or MANAGER
     */
    private java.util.Set<String> computeForbiddenRolesForCurrentUser(Utilisateur current) {
        java.util.Set<String> forbidden = new java.util.HashSet<>();
        if (current == null) {
            forbidden.addAll(java.util.Arrays.asList("SUPERADMIN", "ADMIN", "MANAGER"));
            return forbidden;
        }
        boolean isSuper = isSuperAdmin(current);
        boolean isAdmin = current.getRoles() != null && current.getRoles().stream().anyMatch(r -> "ADMIN".equalsIgnoreCase(r.getName()));
        boolean isManager = current.getRoles() != null && current.getRoles().stream().anyMatch(r -> "MANAGER".equalsIgnoreCase(r.getName()));
        if (isSuper) {
            forbidden.add("SUPERADMIN");
        } else if (isAdmin) {
            forbidden.addAll(java.util.Arrays.asList("SUPERADMIN", "ADMIN"));
        } else if (isManager) {
            forbidden.addAll(java.util.Arrays.asList("SUPERADMIN", "ADMIN", "MANAGER"));
        } else {
            forbidden.addAll(java.util.Arrays.asList("SUPERADMIN", "ADMIN", "MANAGER"));
        }
        return forbidden;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE')")
    public List<Utilisateur> getUsers() {
        Utilisateur current = getCurrentUser();
        if (isSuperAdmin(current)) {
            return utilisateurService.findAll();
        }
        if (current.getBoutique() == null) {
            return List.of();
        }
        return utilisateurService.findAllByBoutiqueId(current.getBoutique().getId());
    }

    /** Return the authenticated user details for client-side defaulting and permission checks */
    @GetMapping("/me")
    public ResponseEntity<Utilisateur> getCurrentAuthenticatedUser() {
        try {
            Utilisateur u = getCurrentUser();
            // Ensure returned user contains effective permissions (direct + role-inherited)
            java.util.Set<com.smboutique.api.model.Permission> combined = new java.util.HashSet<>();
            if (u.getPermissions() != null) combined.addAll(u.getPermissions());
            if (u.getRoles() != null) {
                for (com.smboutique.api.model.Role r : u.getRoles()) {
                    if (r.getPermissions() != null) combined.addAll(r.getPermissions());
                }
            }
            u.setPermissions(combined);
            return ResponseEntity.ok(u);
        } catch (Exception e) {
            return ResponseEntity.status(401).build();
        }
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE')")
    public ResponseEntity<?> getUserById(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        Optional<Utilisateur> opt = utilisateurService.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(404)
                    .body(java.util.Collections.singletonMap("message", "Utilisateur introuvable"));
        }
        Utilisateur target = opt.get();
        if (!isSuperAdmin(current) && !sameBoutique(current, target.getBoutique())) {
            return ResponseEntity.status(403)
                    .body(java.util.Collections.singletonMap("message", "Accès refusé à cet utilisateur"));
        }
        return ResponseEntity.ok(target);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE')")
    public ResponseEntity<?> createUser(@RequestBody Utilisateur utilisateur) {
        Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current)) {
            utilisateur.setBoutique(current.getBoutique());
        } else if (utilisateur.getBoutique() != null && utilisateur.getBoutique().getId() != null) {
            Optional<Boutique> boutique = boutiqueService.findById(utilisateur.getBoutique().getId());
            utilisateur.setBoutique(boutique.orElse(null));
        }

        // Only SUPERADMIN or users with UTILISATEUR_GERER may set permissions on new users; otherwise start with empty permissions
        if (!isSuperAdmin(current) && !utilisateurService.hasPermission(current, "UTILISATEUR_GERER")) {
            utilisateur.setPermissions(new java.util.HashSet<>());
        }

        // Validate roles: disallow assigning roles equal or higher than current user's allowed scope
        java.util.Set<String> forbidden = computeForbiddenRolesForCurrentUser(current);
        if (utilisateur.getRoles() != null) {
            boolean forbiddenRoleAssigned = utilisateur.getRoles().stream()
                    .anyMatch(r -> r.getName() != null && forbidden.contains(r.getName().toUpperCase()));
            if (forbiddenRoleAssigned) {
                return ResponseEntity.status(403)
                        .body(java.util.Collections.singletonMap("message", "Rôle non autorisé"));
            }
        }
        // Validate requested user type (typeUtilisateur)
        if (utilisateur.getTypeUtilisateur() != null) {
            // If current user can manage users, allow any type except SUPERADMIN unless current is SUPERADMIN
            if (isSuperAdmin(current)) {
                // superadmin can assign any type
            } else if (utilisateurService.hasPermission(current, "UTILISATEUR_GERER")) {
                if ("SUPERADMIN".equalsIgnoreCase(utilisateur.getTypeUtilisateur())) {
                    return ResponseEntity.status(403)
                            .body(java.util.Collections.singletonMap("message", "Type d'utilisateur non autorisé"));
                }
            } else {
                // fallback to role hierarchy-based restrictions
                java.util.Set<String> forbiddenTypes = new java.util.HashSet<>();
                if (forbidden.contains("SUPERADMIN")) forbiddenTypes.add("SUPERADMIN");
                if (forbidden.contains("ADMIN")) forbiddenTypes.add("ADMINISTRATEUR");
                if (forbidden.contains("MANAGER")) forbiddenTypes.add("GERANT_BOUTIQUE");
                if (forbiddenTypes.contains(utilisateur.getTypeUtilisateur().toUpperCase())) {
                    return ResponseEntity.status(403)
                            .body(java.util.Collections.singletonMap("message", "Type d'utilisateur non autorisé"));
                }
            }
        }

        // Validate phone if provided
        if (utilisateur.getContact() != null && !utilisateur.getContact().isEmpty()) {
            if (utilisateur.getCodePays() == null || utilisateur.getCodePays().isEmpty()) {
                return ResponseEntity.status(400).body(java.util.Collections.singletonMap("message", "Code pays manquant pour la validation du téléphone"));
            }
            try {
                String normalized = phoneService.validateAndNormalize(utilisateur.getContact(), utilisateur.getCodePays());
                utilisateur.setContact(normalized);
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(java.util.Collections.singletonMap("message", e.getMessage()));
            }
        }

        if (utilisateur.getMotDePasse() != null && !utilisateur.getMotDePasse().isEmpty()) {
            utilisateur.setMotDePasse(passwordEncoder.encode(utilisateur.getMotDePasse()));
        }
        Utilisateur saved = utilisateurService.save(utilisateur);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE')")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody Utilisateur utilisateurDetails) {
        Utilisateur current = getCurrentUser();
        Optional<Utilisateur> opt = utilisateurService.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(404)
                    .body(java.util.Collections.singletonMap("message", "Utilisateur introuvable"));
        }
        Utilisateur existing = opt.get();
        if (!isSuperAdmin(current) && !sameBoutique(current, existing.getBoutique())) {
            return ResponseEntity.status(403)
                    .body(java.util.Collections.singletonMap("message", "Accès refusé à cet utilisateur"));
        }

        existing.setNom(utilisateurDetails.getNom());
        existing.setPrenom(utilisateurDetails.getPrenom());
        existing.setPseudo(utilisateurDetails.getPseudo());
        existing.setEmail(utilisateurDetails.getEmail());

        // Validate phone if provided
        if (utilisateurDetails.getContact() != null && !utilisateurDetails.getContact().isEmpty()) {
            if (utilisateurDetails.getCodePays() == null || utilisateurDetails.getCodePays().isEmpty()) {
                return ResponseEntity.status(400).body(java.util.Collections.singletonMap("message", "Code pays manquant pour la validation du téléphone"));
            }
            try {
                String normalized = phoneService.validateAndNormalize(utilisateurDetails.getContact(), utilisateurDetails.getCodePays());
                existing.setContact(normalized);
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(java.util.Collections.singletonMap("message", e.getMessage()));
            }
        } else {
            existing.setContact(utilisateurDetails.getContact());
        }
        existing.setCodePays(utilisateurDetails.getCodePays());

        // Validate requested user type (typeUtilisateur)
        if (utilisateurDetails.getTypeUtilisateur() != null) {
            if (isSuperAdmin(current)) {
                // superadmin can assign any type
            } else if (utilisateurService.hasPermission(current, "UTILISATEUR_GERER")) {
                if ("SUPERADMIN".equalsIgnoreCase(utilisateurDetails.getTypeUtilisateur())) {
                    return ResponseEntity.status(403)
                            .body(java.util.Collections.singletonMap("message", "Type d'utilisateur non autorisé"));
                }
            } else {
                java.util.Set<String> forbiddenTypes = new java.util.HashSet<>();
                java.util.Set<String> forbiddenRoles = computeForbiddenRolesForCurrentUser(current);
                if (forbiddenRoles.contains("SUPERADMIN")) forbiddenTypes.add("SUPERADMIN");
                if (forbiddenRoles.contains("ADMIN")) forbiddenTypes.add("ADMINISTRATEUR");
                if (forbiddenRoles.contains("MANAGER")) forbiddenTypes.add("GERANT_BOUTIQUE");
                if (forbiddenTypes.contains(utilisateurDetails.getTypeUtilisateur().toUpperCase())) {
                    return ResponseEntity.status(403)
                            .body(java.util.Collections.singletonMap("message", "Type d'utilisateur non autorisé"));
                }
            }
        }
        existing.setTypeUtilisateur(utilisateurDetails.getTypeUtilisateur());
        existing.setAdresse(utilisateurDetails.getAdresse());
        existing.setStatut(utilisateurDetails.getStatut());

        if (isSuperAdmin(current)) {
            existing.setBoutique(utilisateurDetails.getBoutique());
        } else {
            existing.setBoutique(current.getBoutique());
        }

        // Validate roles assignment: disallow assigning equal or higher roles
        java.util.Set<String> forbidden = computeForbiddenRolesForCurrentUser(current);
        if (utilisateurDetails.getRoles() != null) {
            boolean forbiddenRoleAssigned = utilisateurDetails.getRoles().stream()
                    .anyMatch(r -> r.getName() != null && forbidden.contains(r.getName().toUpperCase()));
            if (forbiddenRoleAssigned) {
                return ResponseEntity.status(403)
                        .body(java.util.Collections.singletonMap("message", "Rôle non autorisé"));
            }
        }
        existing.setRoles(utilisateurDetails.getRoles());
        // Only SUPERADMIN or users with UTILISATEUR_GERER may set permissions
        if (isSuperAdmin(current) || utilisateurService.hasPermission(current, "UTILISATEUR_GERER")) {
            existing.setPermissions(utilisateurDetails.getPermissions());
        } else {
            // ignore incoming permission changes for non-authorized updaters
            logger.info("User {} attempted to modify permissions of user {} but lacks UTILISATEUR_GERER", current.getEmail(), existing.getEmail());
        }
        if (utilisateurDetails.getMotDePasse() != null && !utilisateurDetails.getMotDePasse().isEmpty()) {
            existing.setMotDePasse(passwordEncoder.encode(utilisateurDetails.getMotDePasse()));
        }
        return ResponseEntity.ok(utilisateurService.save(existing));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE')")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        return utilisateurService.findById(id)
                .map(utilisateur -> {
                    if (!isSuperAdmin(current) && !sameBoutique(current, utilisateur.getBoutique())) {
                        return ResponseEntity.status(403).<Void>build();
                    }
                    utilisateurService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/statut")
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE')")
    public ResponseEntity<?> updateStatut(@PathVariable Long id, @RequestBody java.util.Map<String, String> body) {
        Utilisateur current = getCurrentUser();
        String statut = body.get("statut");
        if (statut == null) {
            return ResponseEntity.badRequest().build();
        }

        Optional<Utilisateur> opt = utilisateurService.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(404)
                    .body(java.util.Collections.singletonMap("message", "Utilisateur introuvable"));
        }
        Utilisateur existing = opt.get();

        // Ensure the current user is allowed to change status: must be superadmin or have UTILISATEUR_ACTIVER_DESACTIVER permission
        if (!isSuperAdmin(current) && !sameBoutique(current, existing.getBoutique())) {
            return ResponseEntity.status(403)
                    .body(java.util.Collections.singletonMap("message", "Accès refusé à cet utilisateur"));
        }
        if (!isSuperAdmin(current) && !utilisateurService.hasPermission(current, "UTILISATEUR_ACTIVER_DESACTIVER")) {
            return ResponseEntity.status(403)
                    .body(java.util.Collections.singletonMap("message", "Permission manquante"));
        }

        existing.setStatut(statut);
        return ResponseEntity.ok(utilisateurService.save(existing));
    }
}
