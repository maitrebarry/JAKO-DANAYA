package com.smboutique.api.controller;

import com.smboutique.api.model.Permission;
import com.smboutique.api.model.Role;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.model.Boutique;
import com.smboutique.api.repository.PermissionRepository;
import com.smboutique.api.repository.RoleRepository;
import com.smboutique.api.repository.UtilisateurRepository;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
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

    @Autowired
    private com.smboutique.api.repository.BoutiqueRepository boutiqueRepository;

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

    @GetMapping("/assignable-roles")
    public List<Role> getAssignableRoles() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) return List.of();
        Utilisateur current = utilisateurRepository.findByEmailIgnoreCase(authentication.getName()).orElse(null);
        List<Role> all = roleRepository.findAll();
        java.util.Set<String> forbidden = new java.util.HashSet<>();
        if (current != null) {
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
        } else {
            forbidden.addAll(java.util.Arrays.asList("SUPERADMIN", "ADMIN", "MANAGER"));
        }
        return all.stream().filter(r -> !forbidden.contains(r.getName().toUpperCase())).collect(Collectors.toList());
    }

    // --- Admin endpoints for dashboard ---
    @GetMapping({"/shops/list","/shops"})
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE')")
    public List<ShopDTO> listShops() {
        List<Boutique> shops = boutiqueRepository.findAll();
        if (shops == null) return List.of();
        return shops.stream().map(b -> new ShopDTO(b.getId(), b.getNom(), b.getQuartier())).collect(Collectors.toList());
    }

    @GetMapping("/alerts")
    public List<AlertDTO> listAlerts() {
        // read last log lines and filter
        File log = new File("logs/application.log");
        if (!log.exists()) return List.of();
        try {
            List<String> lines = Files.readAllLines(log.toPath());
            List<AlertDTO> alerts = new ArrayList<>();
            for (int i = Math.max(0, lines.size() - 200); i < lines.size(); i++) {
                String line = lines.get(i);
                if (line.contains("ERROR") || line.contains("CRITICAL") || line.contains("WARN")) {
                    String level = line.contains("ERROR") || line.contains("CRITICAL") ? "CRITICAL" : "WARN";
                    alerts.add(new AlertDTO(i, level, line, Instant.now().toString()));
                }
            }
            Collections.reverse(alerts);
            return alerts;
        } catch (IOException e) {
            return List.of();
        }
    }

    @GetMapping("/logs")
    public List<String> tailLogs(@RequestParam(value = "lines", required = false, defaultValue = "200") int lines) {
        File log = new File("logs/application.log");
        if (!log.exists()) return List.of();
        try {
            List<String> all = Files.readAllLines(log.toPath());
            int from = Math.max(0, all.size() - lines);
            return all.subList(from, all.size());
        } catch (IOException e) {
            return List.of();
        }
    }

    public static class ShopDTO {
        public Long id;
        public String name;
        public String statut;

        public ShopDTO(Long id, String name, String statut) {
            this.id = id;
            this.name = name;
            this.statut = statut;
        }
    }

    public static class AlertDTO {
        public int id;
        public String level;
        public String message;
        public String createdAt;

        public AlertDTO(int id, String level, String message, String createdAt) {
            this.id = id;
            this.level = level;
            this.message = message;
            this.createdAt = createdAt;
        }
    }
}
