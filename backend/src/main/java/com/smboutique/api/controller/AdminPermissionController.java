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

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private PermissionService permissionService;

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
        boolean hasRole = user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
        boolean hasType = "SUPERADMIN".equalsIgnoreCase(user.getTypeUtilisateur());
        return hasRole || hasType;
    }

    @PreAuthorize("hasAnyRole('SUPERADMIN','PROPRIETAIRE','ADMINISTRATEUR')")
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

    @PreAuthorize("hasAnyRole('SUPERADMIN','PROPRIETAIRE','ADMINISTRATEUR')")
    @GetMapping("/admin/permissions")
    public List<Permission> listPermissions() {
        return permissionService.findAll();
    }

    @PreAuthorize("hasAnyRole('SUPERADMIN','PROPRIETAIRE','ADMINISTRATEUR')")
    @GetMapping("/admin/utilisateurs/{id}/permissions")
    public ResponseEntity<Set<Permission>> getUserPermissions(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        return utilisateurService.findById(id)
                .map(utilisateur -> {
                    if (!isSuperAdmin(current)) {
                        if (current.getBoutique() == null || utilisateur.getBoutique() == null || !current.getBoutique().getId().equals(utilisateur.getBoutique().getId())) {
                            return ResponseEntity.status(403).<Set<Permission>>build();
                        }
                    }
                    return ResponseEntity.ok(utilisateur.getPermissions());
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PreAuthorize("hasAnyRole('SUPERADMIN','PROPRIETAIRE','ADMINISTRATEUR')")
    @PostMapping("/admin/utilisateurs/{id}/permissions")
    public ResponseEntity<?> updateUserPermissions(@PathVariable Long id, @RequestBody List<Long> permissionIds) {
        Utilisateur current = getCurrentUser();
        return utilisateurService.findById(id)
                .map(utilisateur -> {
                    if (!isSuperAdmin(current)) {
                        if (current.getBoutique() == null || utilisateur.getBoutique() == null || !current.getBoutique().getId().equals(utilisateur.getBoutique().getId())) {
                            return ResponseEntity.status(403).build();
                        }
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
