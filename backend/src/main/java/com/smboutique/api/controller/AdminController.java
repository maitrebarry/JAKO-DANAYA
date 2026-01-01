package com.smboutique.api.controller;

import com.smboutique.api.model.Permission;
import com.smboutique.api.model.Role;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.PermissionRepository;
import com.smboutique.api.repository.RoleRepository;
import com.smboutique.api.repository.UtilisateurRepository;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
public class AdminController {

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UtilisateurService utilisateurService;

    private boolean isSuperAdmin(Utilisateur user) {
        if (user == null) return false;
        // Determine superadmin by role membership only
        return user.getRoles() != null && user.getRoles().stream()
                .anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
    }

    @PostMapping("/reset-permissions")
    public ResponseEntity<?> resetPermissions() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(403).build();
        }
        Utilisateur current = utilisateurRepository.findByEmailIgnoreCase(authentication.getName()).orElse(null);
        if (!isSuperAdmin(current)) return ResponseEntity.status(403).body("Only superadmin can reset permissions");

        // Define canonical permission list (derived from DataInitializer / current usage)
        String[] perms = new String[]{
            "TABLEAU_DE_BORD_LECTURE",
            "UTILISATEUR_GERER","UTILISATEUR_LECTURE","UTILISATEUR_CREER","UTILISATEUR_MODIFIER","UTILISATEUR_SUPPRIMER",
            "PRODUIT_LECTURE","PRODUIT_CREER","PRODUIT_MODIFIER","PRODUIT_SUPPRIMER",
            "COMMANDE_LECTURE","COMMANDE_CREER","COMMANDE_MODIFIER","COMMANDE_SUPPRIMER",
            "CLIENT_LECTURE","CLIENT_CREER","CLIENT_MODIFIER","CLIENT_SUPPRIMER",
            "VENTE_LECTURE","VENTE_CREER","VENTE_MODIFIER","VENTE_SUPPRIMER",
            "INVENTAIRE_LECTURE","INVENTAIRE_CREER","INVENTAIRE_MODIFIER","INVENTAIRE_SUPPRIMER",
            "FOURNISSEUR_LECTURE","FOURNISSEUR_CREER","FOURNISSEUR_MODIFIER","FOURNISSEUR_SUPPRIMER",
            "BOUTIQUE_LECTURE","BOUTIQUE_CREER","BOUTIQUE_MODIFIER","BOUTIQUE_SUPPRIMER",
            "RAPPORT_LECTURE","RAPPORT_CREER",
            "PARAMETRES_LECTURE","PARAMETRES_MODIFIER",
            "CONFIG_MARGE_LECTURE","CONFIG_MARGE_ECRITURE","CONFIG_MARGE_SUPPRESSION",
            // Payments / Receptions / Livraisons
            "PAIEMENT_CREER","PAIEMENT_MODIFIER","PAIEMENT_SUPPRESSION","PAIEMENT_ANNULATION",
            "RECEPTION_CREER","RECEPTION_MODIFIER","RECEPTION_SUPPRESSION","RECEPTION_ANNULATION",
            "LIVRAISON_ECRITURE",
            // Others
            "ROLE_SUPERADMIN"
        };

        // clear and recreate
        permissionRepository.deleteAll();
        List<Permission> created = Arrays.stream(perms).map(name -> {
            Permission p = new Permission();
            p.setName(name);
            p.setDescription("Auto-generated permission: " + name);
            return permissionRepository.save(p);
        }).collect(Collectors.toList());

        // assign all permissions to users with SUPERADMIN role
        Role superRole = roleRepository.findByName("SUPERADMIN").orElse(null);
        List<Utilisateur> users = utilisateurRepository.findAll();
        for (Utilisateur u : users) {
            boolean has = false;
            if (u.getRoles() != null) has = u.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
            if (has) {
                u.setPermissions(new HashSet<>(created));
                utilisateurRepository.save(u);
            }
        }

        return ResponseEntity.ok("Permissions reset. Created: " + created.size());
    }
}
