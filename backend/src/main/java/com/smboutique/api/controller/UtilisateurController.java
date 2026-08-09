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

    @Autowired
    private com.smboutique.api.repository.UtilisateurRepository utilisateurRepository;

    @Autowired
    private com.smboutique.api.repository.PermissionRepository permissionRepository;

    // Rôles pour lesquels toutes les permissions sont accordées par défaut à la création,
    // à l'exception de celles listées dans DEFAULT_FULL_ACCESS_EXCLUSIONS.
    private static final java.util.Set<String> DEFAULT_FULL_ACCESS_ROLE_TYPES =
            new java.util.HashSet<>(java.util.Arrays.asList("PROPRIETAIRE", "ADMINISTRATEUR"));

    private static final java.util.Set<String> DEFAULT_FULL_ACCESS_EXCLUSIONS =
            new java.util.HashSet<>(java.util.Arrays.asList(
                    "BOUTIQUE_CREER", "BOUTIQUE_SUPPRIMER", "VENTE_EMPLACEMENT_MODIFIER"));

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
    // Aligné sur /api/utilisateurs (écran "Assigner permission") : la liste doit être visible
    // par tout utilisateur habilité à gérer les utilisateurs, pas seulement par 3 rôles précis.
    // Sinon un compte ayant la permission mais un autre rôle (ex. Gérant) recevait un 403 (liste vide).
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE') or hasAnyAuthority('UTILISATEUR_GERER','UTILISATEUR_CREER')")
    public List<java.util.Map<String, Object>> getUsers() {
        Utilisateur current = getCurrentUser();
        List<Utilisateur> users;
        if (isSuperAdmin(current)) {
            users = utilisateurService.findAll();
        } else if (current.getBoutique() != null) {
            users = utilisateurService.findAllByBoutiqueId(current.getBoutique().getId());
        } else {
            users = List.of();
        }
        // On renvoie un DTO compact (et non l'entité brute) : pour un superadmin, findAll() dragge
        // roles+permissions EAGER de tous les utilisateurs -> réponse volumineuse/fragile qui pouvait
        // être tronquée en prod (JSON invalide -> liste vide côté front). Le DTO force aussi
        // l'initialisation de boutique/roles ici, évitant tout souci de lazy-loading à la sérialisation.
        return users.stream().map(this::toUserListDto).toList();
    }

    private java.util.Map<String, Object> toUserListDto(Utilisateur u) {
        java.util.Map<String, Object> dto = new java.util.LinkedHashMap<>();
        dto.put("id", u.getId());
        dto.put("nom", u.getNom());
        dto.put("prenom", u.getPrenom());
        dto.put("email", u.getEmail());
        dto.put("pseudo", u.getPseudo());
        dto.put("contact", u.getContact());
        dto.put("codePays", u.getCodePays());
        dto.put("adresse", u.getAdresse());
        dto.put("avatar", u.getAvatar());
        dto.put("typeUtilisateur", u.getTypeUtilisateur());
        dto.put("statut", u.getStatut());
        dto.put("creeParId", u.getCreeParId());

        if (u.getBoutique() != null) {
            java.util.Map<String, Object> b = new java.util.LinkedHashMap<>();
            b.put("id", u.getBoutique().getId());
            b.put("nom", u.getBoutique().getNom());
            if (u.getBoutique().getPays() != null) {
                java.util.Map<String, Object> pays = new java.util.LinkedHashMap<>();
                pays.put("id", u.getBoutique().getPays().getId());
                pays.put("codeIso", u.getBoutique().getPays().getCodeIso());
                b.put("pays", pays);
            }
            dto.put("boutique", b);
        } else {
            dto.put("boutique", null);
        }

        java.util.List<java.util.Map<String, Object>> roles = new java.util.ArrayList<>();
        if (u.getRoles() != null) {
            for (com.smboutique.api.model.Role r : u.getRoles()) {
                java.util.Map<String, Object> rm = new java.util.LinkedHashMap<>();
                rm.put("id", r.getId());
                rm.put("name", r.getName());
                roles.add(rm);
            }
        }
        dto.put("roles", roles);
        return dto;
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
        utilisateur.setCreePar(current);
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
                if (utilisateurRepository.existsByContact(normalized)) {
                    return ResponseEntity.status(400).body(java.util.Collections.singletonMap("message", "Ce numéro de téléphone est déjà utilisé"));
                }
                utilisateur.setContact(normalized);
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(java.util.Collections.singletonMap("message", e.getMessage()));
            }
        }

        if (utilisateur.getMotDePasse() != null && !utilisateur.getMotDePasse().isEmpty()) {
            utilisateur.setMotDePasse(passwordEncoder.encode(utilisateur.getMotDePasse()));
        }

        // Attribution par défaut : Propriétaire/Administrateur reçoivent toutes les permissions
        // à la création, sauf création/suppression de boutique et modification de l'emplacement de vente.
        if (utilisateur.getTypeUtilisateur() != null
                && DEFAULT_FULL_ACCESS_ROLE_TYPES.contains(utilisateur.getTypeUtilisateur().toUpperCase())
                && (utilisateur.getPermissions() == null || utilisateur.getPermissions().isEmpty())) {
            java.util.Set<com.smboutique.api.model.Permission> defaultPermissions = permissionRepository.findAll()
                    .stream()
                    .filter(p -> p.getName() != null && !DEFAULT_FULL_ACCESS_EXCLUSIONS.contains(p.getName().toUpperCase()))
                    .collect(java.util.stream.Collectors.toSet());
            utilisateur.setPermissions(defaultPermissions);
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
                com.smboutique.api.model.Utilisateur dup = utilisateurRepository.findByContact(normalized).orElse(null);
                if (dup != null && dup.getId() != null && !dup.getId().equals(existing.getId())) {
                    return ResponseEntity.status(400).body(java.util.Collections.singletonMap("message", "Ce numéro de téléphone est déjà utilisé"));
                }
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
