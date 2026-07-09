package com.smboutique.api.controller;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.BoutiqueService;
import com.smboutique.api.service.UtilisateurService;
import com.smboutique.api.service.BoutiquePurgeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.jdbc.core.JdbcTemplate;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/boutiques")
@CrossOrigin(origins = "*")
public class BoutiqueController {

    @Autowired
    private BoutiqueService boutiqueService;

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.repository.PaysRepository paysRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private BoutiquePurgeService boutiquePurgeService;

    private static final String UPLOAD_DIR = "uploads/logos/";

    private void ensureDefaultSubscriptionPlansIfMissing() {
        jdbcTemplate.update(
            "INSERT INTO abonnement_plan (code, libelle, duree_mois, prix, devise, actif, created_at) " +
            "SELECT 'MENSUEL','Mensuel',1,0,'XOF',TRUE,now() " +
            "WHERE NOT EXISTS (SELECT 1 FROM abonnement_plan WHERE code = 'MENSUEL')"
        );
        jdbcTemplate.update(
            "INSERT INTO abonnement_plan (code, libelle, duree_mois, prix, devise, actif, created_at) " +
            "SELECT 'TRIMESTRIEL','Trimestriel',3,0,'XOF',TRUE,now() " +
            "WHERE NOT EXISTS (SELECT 1 FROM abonnement_plan WHERE code = 'TRIMESTRIEL')"
        );
        jdbcTemplate.update(
            "INSERT INTO abonnement_plan (code, libelle, duree_mois, prix, devise, actif, created_at) " +
            "SELECT 'SEMESTRIEL','Semestriel',6,0,'XOF',TRUE,now() " +
            "WHERE NOT EXISTS (SELECT 1 FROM abonnement_plan WHERE code = 'SEMESTRIEL')"
        );
        jdbcTemplate.update(
            "INSERT INTO abonnement_plan (code, libelle, duree_mois, prix, devise, actif, created_at) " +
            "SELECT 'ANNUEL','Annuel',12,0,'XOF',TRUE,now() " +
            "WHERE NOT EXISTS (SELECT 1 FROM abonnement_plan WHERE code = 'ANNUEL')"
        );
    }

    private void createInitialSubscriptionIfPossible(Long boutiqueId, String requestedPlanCode) {
        try {
            ensureDefaultSubscriptionPlansIfMissing();
            String planCode = (requestedPlanCode == null || requestedPlanCode.isBlank()) ? "MENSUEL" : requestedPlanCode.trim().toUpperCase();
            var plans = jdbcTemplate.queryForList(
                "SELECT id, duree_mois FROM abonnement_plan WHERE code = ? AND actif = TRUE LIMIT 1",
                planCode
            );
            if (plans.isEmpty()) {
            plans = jdbcTemplate.queryForList(
                "SELECT id, duree_mois FROM abonnement_plan WHERE actif = TRUE ORDER BY duree_mois ASC LIMIT 1"
            );
            }
            if (plans.isEmpty()) {
                org.slf4j.LoggerFactory.getLogger(BoutiqueController.class)
                    .warn("No active subscription plan found for boutiqueId={} (requestedPlanCode={})", boutiqueId, planCode);
                return;
            }

            Number planIdN = (Number) plans.get(0).get("id");
            Number dureeN = (Number) plans.get(0).get("duree_mois");
            if (planIdN == null || dureeN == null) return;

            Long planId = planIdN.longValue();
            int dureeMois = dureeN.intValue();

            var existing = jdbcTemplate.queryForList(
                "SELECT id FROM abonnement_boutique WHERE boutique_id = ? LIMIT 1",
                boutiqueId
            );
            if (!existing.isEmpty()) return;

            LocalDateTime startAt = LocalDateTime.now();
            LocalDateTime endAt = startAt.plusMonths(dureeMois);

            int inserted = jdbcTemplate.update(
                "INSERT INTO abonnement_boutique (boutique_id, plan_id, statut, date_debut, date_fin, grace_end_at, auto_renew, created_at, updated_at) VALUES (?, ?, 'ACTIVE', ?, ?, NULL, FALSE, now(), now())",
                boutiqueId,
                planId,
                Timestamp.valueOf(startAt),
                Timestamp.valueOf(endAt)
            );
            if (inserted > 0) {
                org.slf4j.LoggerFactory.getLogger(BoutiqueController.class)
                    .info("Initial subscription created for boutiqueId={} with planCode={}", boutiqueId, planCode);
            }
        } catch (Exception ex) {
            // Keep boutique creation backward-compatible even if subscription tables are absent.
            org.slf4j.LoggerFactory.getLogger(BoutiqueController.class)
                .warn("Initial subscription creation skipped for boutiqueId={}: {}", boutiqueId, ex.getMessage());
        }
    }

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

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE')")
    public List<Boutique> getAllBoutiques() {
        Utilisateur current = getCurrentUser();
        if (isSuperAdmin(current)) {
            return boutiqueService.findAll();
        }
        if (current.getBoutique() == null) {
            return List.of();
        }
        return List.of(current.getBoutique());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE')")
    public ResponseEntity<Boutique> getBoutiqueById(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        return boutiqueService.findById(id)
                .map(boutique -> {
                    if (!isSuperAdmin(current)) {
                        if (current.getBoutique() == null || !current.getBoutique().getId().equals(boutique.getId())) {
                            return ResponseEntity.status(403).<Boutique>build();
                        }
                    }
                    return ResponseEntity.ok(boutique);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @Autowired
    private com.smboutique.api.service.PaysSyncService paysSyncService;

    @PostMapping
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> createBoutique(@RequestParam(value = "nom", required = false) String nom,
                                   @RequestParam(value = "quartier", required = false) String quartier,
                                   @RequestParam(value = "adresse", required = false) String adresse,
                                   @RequestParam(value = "indicatif", required = false) String indicatif,
                                   @RequestParam(value = "codePays", required = false) String codePays,
                                   @RequestParam(value = "planCode", required = false) String planCode,
                                   @RequestParam(value = "logo", required = false) MultipartFile logo) throws IOException {
        // Ensure minimal required fields are present
        if (nom == null || nom.trim().isEmpty() || adresse == null || adresse.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Veuillez remplir au moins le nom et l'adresse.");
        }

        Boutique boutique = new Boutique();
        boutique.setNom(nom);
        boutique.setQuartier(quartier);
        boutique.setAdresse(adresse);

        // Set indicatif if provided
        if (indicatif != null && !indicatif.trim().isEmpty()) {
            String indClean = indicatif.replaceAll("\\s", "");
            boutique.setIndicatif(indClean.startsWith("+") ? indClean : "+" + indClean);
        }

        if (logo != null && !logo.isEmpty()) {
            String fileName = UUID.randomUUID().toString() + "_" + logo.getOriginalFilename();
            Path uploadPath = Paths.get(UPLOAD_DIR);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
            Files.write(uploadPath.resolve(fileName), logo.getBytes());
            boutique.setLogo("/" + UPLOAD_DIR + fileName);
        }

        // if codePays provided, associate it (create if unknown)
        if (codePays != null && !codePays.isEmpty()) {
            var p = paysRepository.findByCodeIso(codePays.toUpperCase())
                    .orElseGet(() -> paysSyncService.ensurePays(codePays.toUpperCase()));
            boutique.setPays(p);
        }

        Boutique saved = boutiqueService.save(boutique);
        createInitialSubscriptionIfPossible(saved.getId(), planCode);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> updateBoutique(@PathVariable Long id,
    @RequestParam("nom") String nom,
    @RequestParam("quartier") String quartier,
    @RequestParam("adresse") String adresse,
    @RequestParam(value = "indicatif", required = false) String indicatif,
    @RequestParam(value = "codePays", required = false) String codePays,
    @RequestParam(value = "planCode", required = false) String planCode,
    @RequestParam(value = "logo", required = false) MultipartFile logo) throws IOException {
        return boutiqueService.findById(id)
                .map(boutique -> {
                    boutique.setNom(nom);
                    boutique.setQuartier(quartier);
                    boutique.setAdresse(adresse);

                    // Set indicatif if provided
                    if (indicatif != null && !indicatif.trim().isEmpty()) {
                        String indClean = indicatif.replaceAll("\\s", "");
                        boutique.setIndicatif(indClean.startsWith("+") ? indClean : "+" + indClean);
                    } else {
                        boutique.setIndicatif(null);
                    }

                    if (logo != null && !logo.isEmpty()) {
                        try {
                            String fileName = UUID.randomUUID().toString() + "_" + logo.getOriginalFilename();
                            Path uploadPath = Paths.get(UPLOAD_DIR);
                            if (!Files.exists(uploadPath)) {
                                Files.createDirectories(uploadPath);
                            }
                            Files.write(uploadPath.resolve(fileName), logo.getBytes());
                            boutique.setLogo("/" + UPLOAD_DIR + fileName);
                        } catch (IOException e) {
                            throw new RuntimeException(e);
                        }
                    }

                    if (codePays != null && !codePays.isEmpty()) {
                        var p = paysRepository.findByCodeIso(codePays.toUpperCase())
                                .orElseGet(() -> paysSyncService.ensurePays(codePays.toUpperCase()));
                        boutique.setPays(p);
                        // also save the indicatif if available
                        if (p != null && p.getIndicatif() != null) {
                            boutique.setIndicatif(p.getIndicatif().startsWith("+") ? p.getIndicatif() : "+" + p.getIndicatif());
                        }
                    }
                    // if indicatif was supplied explicitly, store it
                    if (indicatif != null && !indicatif.trim().isEmpty()) {
                        String indClean = indicatif.replaceAll("\\s", "");
                        boutique.setIndicatif(indClean.startsWith("+") ? indClean : "+" + indClean);
                    }

                    Boutique saved = boutiqueService.save(boutique);
                    // On update, auto-attach a subscription if missing (for legacy boutiques created before subscription module).
                    createInitialSubscriptionIfPossible(saved.getId(), planCode);
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> deleteBoutique(
            @PathVariable Long id,
            @RequestParam(value = "confirmation", required = false) String confirmation) {
        return boutiqueService.findById(id)
                .map(boutique -> {
                    if (confirmation == null || !boutique.getNom().equalsIgnoreCase(confirmation.trim())) {
                        return ResponseEntity.badRequest().body(java.util.Map.of(
                                "error", "Confirmation invalide",
                                "message", "Saisissez exactement le nom de la boutique pour confirmer la suppression définitive."
                        ));
                    }
                    try {
                        BoutiquePurgeService.PurgeResult result = boutiquePurgeService.purge(id);
                        org.slf4j.LoggerFactory.getLogger(BoutiqueController.class)
                                .warn("SUPERADMIN purged boutique id={}, name={}, deletedRows={}",
                                        id, boutique.getNom(), result.totalDeleted());
                        return ResponseEntity.ok(result);
                    } catch (Exception ex) {
                        org.slf4j.LoggerFactory.getLogger(BoutiqueController.class)
                                .error("Atomic boutique purge failed for id={}", id, ex);
                        return ResponseEntity.status(409).body(java.util.Map.of(
                                "error", "Suppression annulée",
                                "message", "La boutique n’a pas été supprimée car une dépendance n’a pas pu être nettoyée."
                        ));
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
