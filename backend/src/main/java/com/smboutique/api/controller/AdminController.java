package com.smboutique.api.controller;

import com.smboutique.api.model.Permission;
import com.smboutique.api.model.Role;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.model.Boutique;
import com.smboutique.api.repository.PermissionRepository;
import com.smboutique.api.repository.RoleRepository;
import com.smboutique.api.repository.UtilisateurRepository;
import com.smboutique.api.service.SubscriptionPaymentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
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
    private com.smboutique.api.repository.BoutiqueRepository boutiqueRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SubscriptionPaymentService subscriptionPaymentService;

    private boolean isSuperAdmin(Utilisateur user) {
        if (user == null) return false;
        // Determine superadmin by role membership only
        return user.getRoles() != null && user.getRoles().stream()
                .anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()) || "ROLE_SUPERADMIN".equalsIgnoreCase(r.getName()));
    }

    private Utilisateur getCurrentUserOrNull() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) return null;
        return utilisateurRepository.findByEmailIgnoreCase(authentication.getName()).orElse(null);
    }

    private ResponseEntity<?> requireSuperAdmin() {
        Utilisateur current = getCurrentUserOrNull();
        if (!isSuperAdmin(current)) {
            return ResponseEntity.status(403).body("Accès réservé au superadmin");
        }
        return null;
    }

    private ResponseEntity<?> subscriptionTablesMissing(DataAccessException ex) {
        return ResponseEntity.status(503).body("Module abonnement non initialisé. Appliquez la migration SQL 20260214_add_abonnement_tables.sql");
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

    // -----------------------------
    // SUBSCRIPTIONS (SUPERADMIN)
    // -----------------------------

    @GetMapping("/subscriptions/plans")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> listSubscriptionPlans() {
        ResponseEntity<?> denied = requireSuperAdmin();
        if (denied != null) return denied;
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT id, code, libelle, duree_mois, prix, devise, actif, created_at, updated_at FROM abonnement_plan ORDER BY duree_mois ASC"
            );
            return ResponseEntity.ok(rows);
        } catch (DataAccessException ex) {
            return subscriptionTablesMissing(ex);
        }
    }

    @PostMapping("/subscriptions/plans")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> createSubscriptionPlan(@RequestBody PlanCreateRequest req) {
        ResponseEntity<?> denied = requireSuperAdmin();
        if (denied != null) return denied;
        if (req == null) return ResponseEntity.badRequest().body("Payload manquant");

        String code = req.code != null ? req.code.trim().toUpperCase() : "";
        String libelle = req.libelle != null ? req.libelle.trim() : "";
        String devise = req.devise != null && !req.devise.isBlank() ? req.devise.trim().toUpperCase() : "XOF";
        Integer duree = req.dureeMois;
        java.math.BigDecimal prix = req.prix;
        Boolean actif = req.actif != null ? req.actif : Boolean.TRUE;

        if (code.isBlank()) return ResponseEntity.badRequest().body("Le code est obligatoire");
        if (libelle.isBlank()) return ResponseEntity.badRequest().body("Le libellé est obligatoire");
        if (duree == null || duree < 0) return ResponseEntity.badRequest().body("La durée (mois) ne peut pas être négative (0 = licence à vie)");
        if (prix == null || prix.compareTo(java.math.BigDecimal.ZERO) < 0) return ResponseEntity.badRequest().body("Le prix ne peut pas être négatif");

        try {
            Boolean exists = jdbcTemplate.queryForObject(
                    "SELECT EXISTS(SELECT 1 FROM abonnement_plan WHERE UPPER(code) = ?)",
                    Boolean.class,
                    code
            );
            if (Boolean.TRUE.equals(exists)) {
                return ResponseEntity.badRequest().body("Ce code de plan existe déjà: " + code);
            }

            jdbcTemplate.update(
                    "INSERT INTO abonnement_plan (code, libelle, duree_mois, prix, devise, actif, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, now(), now())",
                    code,
                    libelle,
                    duree,
                    prix,
                    devise,
                    actif
            );

            Map<String, Object> row = jdbcTemplate.queryForMap(
                    "SELECT id, code, libelle, duree_mois, prix, devise, actif, created_at, updated_at FROM abonnement_plan WHERE code = ?",
                    code
            );
            return ResponseEntity.ok(row);
        } catch (DataAccessException ex) {
            return subscriptionTablesMissing(ex);
        }
    }

    @PutMapping("/subscriptions/plans/{code}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> updateSubscriptionPlan(@PathVariable String code, @RequestBody PlanUpdateRequest req) {
        ResponseEntity<?> denied = requireSuperAdmin();
        if (denied != null) return denied;
        if (req == null) return ResponseEntity.badRequest().body("Payload manquant");
        try {
            int updated = jdbcTemplate.update(
                    "UPDATE abonnement_plan SET libelle = COALESCE(?, libelle), duree_mois = COALESCE(?, duree_mois), prix = COALESCE(?, prix), devise = COALESCE(?, devise), actif = COALESCE(?, actif), updated_at = now() WHERE code = ?",
                    req.libelle,
                    req.dureeMois,
                    req.prix,
                    req.devise,
                    req.actif,
                    code
            );
            if (updated == 0) return ResponseEntity.notFound().build();
            Map<String, Object> row = jdbcTemplate.queryForMap(
                    "SELECT id, code, libelle, duree_mois, prix, devise, actif, created_at, updated_at FROM abonnement_plan WHERE code = ?",
                    code
            );
            return ResponseEntity.ok(row);
        } catch (DataAccessException ex) {
            return subscriptionTablesMissing(ex);
        }
    }

    @DeleteMapping("/subscriptions/plans/{code}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> deleteSubscriptionPlan(@PathVariable String code) {
        ResponseEntity<?> denied = requireSuperAdmin();
        if (denied != null) return denied;
        String normalizedCode = code == null ? "" : code.trim().toUpperCase();
        if (normalizedCode.isBlank()) return ResponseEntity.badRequest().body("Code plan invalide");
        if ("MENSUEL".equalsIgnoreCase(normalizedCode)) {
            return ResponseEntity.badRequest().body("Le plan MENSUEL ne peut pas être supprimé");
        }

        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT id FROM abonnement_plan WHERE UPPER(code) = ? LIMIT 1",
                    normalizedCode
            );
            if (rows.isEmpty()) return ResponseEntity.notFound().build();

            Long planId = ((Number) rows.get(0).get("id")).longValue();
            Number usage = jdbcTemplate.queryForObject(
                    "SELECT COUNT(1) FROM abonnement_boutique WHERE plan_id = ?",
                    Number.class,
                    planId
            );
            long usageCount = usage == null ? 0L : usage.longValue();

            if (usageCount > 0) {
                jdbcTemplate.update(
                        "UPDATE abonnement_plan SET actif = FALSE, updated_at = now() WHERE id = ?",
                        planId
                );
                return ResponseEntity.ok(Map.of("ok", true, "deleted", false, "disabled", true, "message", "Plan utilisé dans l'historique: désactivé"));
            }

            jdbcTemplate.update("DELETE FROM abonnement_plan WHERE id = ?", planId);
            return ResponseEntity.ok(Map.of("ok", true, "deleted", true));
        } catch (DataAccessException ex) {
            return subscriptionTablesMissing(ex);
        }
    }

    @GetMapping("/subscriptions/boutiques")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> listBoutiqueSubscriptions() {
        ResponseEntity<?> denied = requireSuperAdmin();
        if (denied != null) return denied;
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT b.id_boutique AS boutique_id, b.nom AS boutique_nom, ab.id AS abonnement_id, ab.statut, ab.date_debut, ab.date_fin, ab.grace_end_at, ab.auto_renew, p.code AS plan_code, p.libelle AS plan_libelle, p.duree_mois, p.prix, p.devise " +
                    "FROM boutique b " +
                    "LEFT JOIN LATERAL (SELECT ab1.* FROM abonnement_boutique ab1 WHERE ab1.boutique_id = b.id_boutique ORDER BY ab1.id DESC LIMIT 1) ab ON TRUE " +
                    "LEFT JOIN abonnement_plan p ON p.id = ab.plan_id " +
                    "ORDER BY b.id_boutique ASC"
            );
            return ResponseEntity.ok(rows);
        } catch (DataAccessException ex) {
            return subscriptionTablesMissing(ex);
        }
    }

    @GetMapping("/subscriptions/boutiques/{boutiqueId}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> getBoutiqueSubscription(@PathVariable Long boutiqueId) {
        ResponseEntity<?> denied = requireSuperAdmin();
        if (denied != null) return denied;
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT b.id_boutique AS boutique_id, b.nom AS boutique_nom, ab.id AS abonnement_id, ab.statut, ab.date_debut, ab.date_fin, ab.grace_end_at, ab.auto_renew, p.code AS plan_code, p.libelle AS plan_libelle, p.duree_mois, p.prix, p.devise " +
                    "FROM boutique b " +
                    "LEFT JOIN LATERAL (SELECT ab1.* FROM abonnement_boutique ab1 WHERE ab1.boutique_id = b.id_boutique ORDER BY ab1.id DESC LIMIT 1) ab ON TRUE " +
                    "LEFT JOIN abonnement_plan p ON p.id = ab.plan_id " +
                    "WHERE b.id_boutique = ?",
                    boutiqueId
            );
            if (rows.isEmpty()) return ResponseEntity.notFound().build();
            return ResponseEntity.ok(rows.get(0));
        } catch (DataAccessException ex) {
            return subscriptionTablesMissing(ex);
        }
    }

    @PostMapping("/subscriptions/boutiques/{boutiqueId}/activate")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> activateBoutiqueSubscription(@PathVariable Long boutiqueId, @RequestBody(required = false) ActivateSubscriptionRequest req) {
        ResponseEntity<?> denied = requireSuperAdmin();
        if (denied != null) return denied;
        String planCode = req != null && req.planCode != null && !req.planCode.isBlank() ? req.planCode.trim().toUpperCase() : "MENSUEL";
        LocalDateTime startAt = (req != null && req.startAt != null) ? req.startAt : LocalDateTime.now();
        try {
            List<Map<String, Object>> planRows = jdbcTemplate.queryForList(
                    "SELECT id, duree_mois FROM abonnement_plan WHERE code = ? AND actif = TRUE",
                    planCode
            );
            if (planRows.isEmpty()) return ResponseEntity.badRequest().body("Plan introuvable ou inactif: " + planCode);

            Long planId = ((Number) planRows.get(0).get("id")).longValue();
            Object dureeObj = planRows.get(0).get("duree_mois");
            Integer dureeMois = dureeObj != null ? ((Number) dureeObj).intValue() : null;
            // duree_mois <= 0 (ex: plan ACHAT) => licence à vie : pas de date de fin.
            boolean lifetime = dureeMois == null || dureeMois <= 0;
            Object dateFinParam = lifetime ? null : Timestamp.valueOf(startAt.plusMonths(dureeMois));

            int inserted = jdbcTemplate.update(
                    "INSERT INTO abonnement_boutique (boutique_id, plan_id, statut, date_debut, date_fin, grace_end_at, auto_renew, created_at, updated_at) VALUES (?, ?, 'ACTIVE', ?, ?, NULL, FALSE, now(), now())",
                    boutiqueId,
                    planId,
                    Timestamp.valueOf(startAt),
                    dateFinParam
            );
            if (inserted == 0) return ResponseEntity.status(500).body("Impossible d'activer l'abonnement");

            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT ab.id AS abonnement_id, ab.boutique_id, ab.statut, ab.date_debut, ab.date_fin, p.code AS plan_code, p.libelle AS plan_libelle " +
                    "FROM abonnement_boutique ab JOIN abonnement_plan p ON p.id = ab.plan_id " +
                    "WHERE ab.boutique_id = ? ORDER BY ab.id DESC LIMIT 1",
                    boutiqueId
            );
            return ResponseEntity.ok(rows.isEmpty() ? Map.of("ok", true) : rows.get(0));
        } catch (DataAccessException ex) {
            return subscriptionTablesMissing(ex);
        }
    }

    @PostMapping("/subscriptions/boutiques/{boutiqueId}/suspend")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> suspendBoutiqueSubscription(@PathVariable Long boutiqueId) {
        ResponseEntity<?> denied = requireSuperAdmin();
        if (denied != null) return denied;
        try {
            int updated = jdbcTemplate.update(
                    "UPDATE abonnement_boutique SET statut = 'CANCELED', updated_at = now() WHERE id = (SELECT ab.id FROM abonnement_boutique ab WHERE ab.boutique_id = ? ORDER BY ab.id DESC LIMIT 1)",
                    boutiqueId
            );
            if (updated == 0) return ResponseEntity.notFound().build();
            Map<String, Object> result = new HashMap<>();
            result.put("boutiqueId", boutiqueId);
            result.put("status", "CANCELED");
            return ResponseEntity.ok(result);
        } catch (DataAccessException ex) {
            return subscriptionTablesMissing(ex);
        }
    }

    @PutMapping("/subscriptions/boutiques/{boutiqueId}/dates")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> updateBoutiqueSubscriptionDates(@PathVariable Long boutiqueId, @RequestBody UpdateSubscriptionDatesRequest req) {
        ResponseEntity<?> denied = requireSuperAdmin();
        if (denied != null) return denied;
        if (req == null || req.dateDebut == null || req.dateFin == null) {
            return ResponseEntity.badRequest().body("dateDebut et dateFin sont requis");
        }
        if (!req.dateFin.isAfter(req.dateDebut)) {
            return ResponseEntity.badRequest().body("dateFin doit être postérieure à dateDebut");
        }
        try {
            int updated = jdbcTemplate.update(
                    "UPDATE abonnement_boutique SET date_debut = ?, date_fin = ?, updated_at = now() " +
                    "WHERE id = (SELECT ab.id FROM abonnement_boutique ab WHERE ab.boutique_id = ? ORDER BY ab.id DESC LIMIT 1)",
                    Timestamp.valueOf(req.dateDebut),
                    Timestamp.valueOf(req.dateFin),
                    boutiqueId
            );
            if (updated == 0) return ResponseEntity.notFound().build();

            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT ab.id AS abonnement_id, ab.boutique_id, ab.statut, ab.date_debut, ab.date_fin, p.code AS plan_code, p.libelle AS plan_libelle " +
                    "FROM abonnement_boutique ab JOIN abonnement_plan p ON p.id = ab.plan_id " +
                    "WHERE ab.boutique_id = ? ORDER BY ab.id DESC LIMIT 1",
                    boutiqueId
            );
            return ResponseEntity.ok(rows.isEmpty() ? Map.of("ok", true) : rows.get(0));
        } catch (DataAccessException ex) {
            return subscriptionTablesMissing(ex);
        }
    }

    @GetMapping("/subscriptions/payments")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> listSubscriptionPayments(@RequestParam(value = "status", required = false) String status) {
        ResponseEntity<?> denied = requireSuperAdmin();
        if (denied != null) return denied;
        try {
            return ResponseEntity.ok(subscriptionPaymentService.listPaymentsForAdmin(status));
        } catch (DataAccessException ex) {
            return subscriptionTablesMissing(ex);
        }
    }

    @PostMapping("/subscriptions/payments/{paymentId}/approve")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> approveSubscriptionPayment(@PathVariable Long paymentId) {
        ResponseEntity<?> denied = requireSuperAdmin();
        if (denied != null) return denied;
        try {
            Utilisateur current = getCurrentUserOrNull();
            return ResponseEntity.ok(subscriptionPaymentService.simulateSuccess(current, paymentId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        } catch (DataAccessException ex) {
            return subscriptionTablesMissing(ex);
        }
    }

    @PostMapping("/subscriptions/payments/{paymentId}/reject")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> rejectSubscriptionPayment(@PathVariable Long paymentId, @RequestBody(required = false) RejectPaymentRequest req) {
        ResponseEntity<?> denied = requireSuperAdmin();
        if (denied != null) return denied;
        try {
            Utilisateur current = getCurrentUserOrNull();
            String reason = req != null ? req.reason : null;
            return ResponseEntity.ok(subscriptionPaymentService.rejectPayment(current, paymentId, reason));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        } catch (DataAccessException ex) {
            return subscriptionTablesMissing(ex);
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

    public static class PlanUpdateRequest {
        public String libelle;
        public Integer dureeMois;
        public java.math.BigDecimal prix;
        public String devise;
        public Boolean actif;
    }

    public static class PlanCreateRequest extends PlanUpdateRequest {
        public String code;
    }

    public static class ActivateSubscriptionRequest {
        public String planCode;
        public LocalDateTime startAt;
    }

    public static class UpdateSubscriptionDatesRequest {
        public LocalDateTime dateDebut;
        public LocalDateTime dateFin;
    }

    public static class RejectPaymentRequest {
        public String reason;
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
