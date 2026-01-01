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

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE')")
    public ResponseEntity<Utilisateur> getUserById(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        return utilisateurService.findById(id)
                .map(target -> {
                    if (!isSuperAdmin(current) && !sameBoutique(current, target.getBoutique())) {
                        return ResponseEntity.status(403).<Utilisateur>build();
                    }
                    return ResponseEntity.ok(target);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE')")
    public Utilisateur createUser(@RequestBody Utilisateur utilisateur) {
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
        if (utilisateur.getMotDePasse() != null && !utilisateur.getMotDePasse().isEmpty()) {
            utilisateur.setMotDePasse(passwordEncoder.encode(utilisateur.getMotDePasse()));
        }
        return utilisateurService.save(utilisateur);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE')")
    public ResponseEntity<Utilisateur> updateUser(@PathVariable Long id, @RequestBody Utilisateur utilisateurDetails) {
        Utilisateur current = getCurrentUser();
        return utilisateurService.findById(id)
                .map(existing -> {
                    if (!isSuperAdmin(current) && !sameBoutique(current, existing.getBoutique())) {
                        return ResponseEntity.status(403).<Utilisateur>build();
                    }
                    existing.setNom(utilisateurDetails.getNom());
                    existing.setPrenom(utilisateurDetails.getPrenom());
                    existing.setPseudo(utilisateurDetails.getPseudo());
                    existing.setEmail(utilisateurDetails.getEmail());
                    existing.setTypeUtilisateur(utilisateurDetails.getTypeUtilisateur());
                    existing.setContact(utilisateurDetails.getContact());
                    existing.setAdresse(utilisateurDetails.getAdresse());
                    existing.setStatut(utilisateurDetails.getStatut());

                    if (isSuperAdmin(current)) {
                        existing.setBoutique(utilisateurDetails.getBoutique());
                    } else {
                        existing.setBoutique(current.getBoutique());
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
                })
                .orElse(ResponseEntity.notFound().build());
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
}
