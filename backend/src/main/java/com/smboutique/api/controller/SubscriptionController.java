package com.smboutique.api.controller;

import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.UtilisateurRepository;
import com.smboutique.api.service.SubscriptionPaymentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/subscription")
public class SubscriptionController {

    private static final Logger logger = LoggerFactory.getLogger(SubscriptionController.class);

    private final JdbcTemplate jdbcTemplate;
    private final UtilisateurRepository utilisateurRepository;
    private final SubscriptionPaymentService subscriptionPaymentService;

    @Value("${app.upload.dir:./uploads/}")
    private String uploadDir;

    public SubscriptionController(JdbcTemplate jdbcTemplate,
                                  UtilisateurRepository utilisateurRepository,
                                  SubscriptionPaymentService subscriptionPaymentService) {
        this.jdbcTemplate = jdbcTemplate;
        this.utilisateurRepository = utilisateurRepository;
        this.subscriptionPaymentService = subscriptionPaymentService;
    }

    private Utilisateur getCurrentUserOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || auth.getName().isBlank()) return null;
        return utilisateurRepository.findByEmailIgnoreCase(auth.getName()).orElse(null);
    }

    private void createOwnerSubscriptionNotificationIfNeeded(Long userId, Long boutiqueId, String message, String dateFinIso) {
        if (userId == null || message == null || message.isBlank()) return;
        try {
            String payload = dateFinIso != null && !dateFinIso.isBlank() ? (message + " (échéance: " + dateFinIso + ")") : message;
            Boolean exists = jdbcTemplate.queryForObject(
                    "SELECT EXISTS(SELECT 1 FROM notification WHERE user_id = ? AND is_read = FALSE AND type = 'ABONNEMENT' AND payload = ?)",
                    Boolean.class,
                    userId,
                    payload
            );
            if (Boolean.TRUE.equals(exists)) return;
            jdbcTemplate.update(
                    "INSERT INTO notification (user_id, boutique_id, type, payload, is_read, created_at) VALUES (?, ?, 'ABONNEMENT', ?, FALSE, now())",
                    userId,
                    boutiqueId,
                    payload
            );
        } catch (DataAccessException ignored) {
            // Optional enhancement only; do not block normal flow.
        }
    }

    @GetMapping("/current")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> current() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || auth.getName().isBlank()) {
            return ResponseEntity.status(401).body(Map.of("message", "Authentification requise"));
        }

        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT u.id_utilisateur AS user_id, b.id_boutique AS boutique_id, b.nom AS boutique_nom, ab.statut, ab.date_debut, ab.date_fin, ab.grace_end_at, p.code AS plan_code, p.libelle AS plan_libelle " +
                            "FROM utilisateur u " +
                            "LEFT JOIN boutique b ON b.id_boutique = u.boutique_id " +
                        "LEFT JOIN LATERAL (SELECT ab1.* FROM abonnement_boutique ab1 WHERE ab1.boutique_id = u.boutique_id ORDER BY ab1.id DESC LIMIT 1) ab ON TRUE " +
                            "LEFT JOIN abonnement_plan p ON p.id = ab.plan_id " +
                            "WHERE lower(u.email) = lower(?) " +
                            "LIMIT 1",
                    auth.getName()
            );

            if (rows.isEmpty()) {
                return ResponseEntity.ok(Map.of("configured", false));
            }

            Map<String, Object> row = rows.get(0);
            String statut = row.get("statut") != null ? String.valueOf(row.get("statut")) : null;
            Timestamp finTs = (Timestamp) row.get("date_fin");
            Timestamp graceTs = (Timestamp) row.get("grace_end_at");

            LocalDateTime now = LocalDateTime.now();
            LocalDateTime fin = finTs != null ? finTs.toLocalDateTime() : null;
            LocalDateTime grace = graceTs != null ? graceTs.toLocalDateTime() : null;

            long daysRemaining = fin != null ? ChronoUnit.DAYS.between(now.toLocalDate(), fin.toLocalDate()) : Long.MAX_VALUE;

            boolean expiredByStatus = "EXPIRED".equalsIgnoreCase(statut)
                    || "PAST_DUE".equalsIgnoreCase(statut)
                    || "CANCELED".equalsIgnoreCase(statut);
            boolean expiredByDate = fin != null && now.isAfter(fin) && (grace == null || now.isAfter(grace));
            boolean blocked = expiredByStatus || expiredByDate;

            boolean shouldShowModal = !blocked && fin != null && daysRemaining <= 7 && daysRemaining >= 0;

            // Licence achetée (à vie) : plan ACHAT, ou abonnement ACTIVE sans date de fin.
            // Ces boutiques ne sont jamais bloquées et n'ont pas de rappel de renouvellement.
            String planCode = row.get("plan_code") != null ? String.valueOf(row.get("plan_code")) : null;
            boolean perpetual = "ACHAT".equalsIgnoreCase(planCode)
                    || (!blocked && fin == null && statut != null && "ACTIVE".equalsIgnoreCase(statut));

            Map<String, Object> out = new HashMap<>();
            out.put("configured", statut != null || fin != null);
            out.put("boutiqueId", row.get("boutique_id"));
            out.put("boutiqueNom", row.get("boutique_nom"));
            out.put("planCode", row.get("plan_code"));
            out.put("planLibelle", row.get("plan_libelle"));
            out.put("status", statut);
            out.put("dateFin", row.get("date_fin"));
            out.put("daysRemaining", (perpetual || fin == null) ? null : daysRemaining);
            out.put("blocked", blocked);
            out.put("perpetual", perpetual);
            out.put("shouldShowModal", !perpetual && shouldShowModal);
            out.put("message", perpetual
                    ? "Application achetée — accès illimité"
                    : (blocked
                        ? "Votre abonnement est expiré. Veuillez renouveler pour continuer."
                        : (shouldShowModal
                            ? "Votre abonnement arrive à échéance dans " + daysRemaining + " jour(s)."
                            : null)));

            Long userId = row.get("user_id") instanceof Number ? ((Number) row.get("user_id")).longValue() : null;
            Long boutiqueId = row.get("boutique_id") instanceof Number ? ((Number) row.get("boutique_id")).longValue() : null;
            if (blocked || shouldShowModal) {
                createOwnerSubscriptionNotificationIfNeeded(
                        userId,
                        boutiqueId,
                        String.valueOf(out.get("message")),
                        fin != null ? fin.toLocalDate().toString() : null
                );
            }

            return ResponseEntity.ok(out);
        } catch (DataAccessException ex) {
            return ResponseEntity.status(503).body(Map.of(
                    "configured", false,
                    "message", "Module abonnement non initialisé"
            ));
        }
    }

    @GetMapping("/plans")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> plans() {
        try {
            // Plans self-service pour le client (réabonnement). On exclut les plans à vie
            // (duree_mois = 0, ex: ACHAT) : la licence achetée est attribuée par le SuperAdmin,
            // le client ne doit jamais pouvoir la choisir ici.
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT id, code, libelle, duree_mois, prix, devise FROM abonnement_plan WHERE actif = TRUE AND duree_mois > 0 ORDER BY duree_mois ASC"
            );
            return ResponseEntity.ok(rows);
        } catch (DataAccessException ex) {
            return ResponseEntity.status(503).body(Map.of("message", "Module abonnement non initialisé"));
        }
    }

    @GetMapping("/payments")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> payments() {
        Utilisateur u = getCurrentUserOrNull();
        if (u == null) return ResponseEntity.status(401).body(Map.of("message", "Authentification requise"));
        try {
            return ResponseEntity.ok(subscriptionPaymentService.listPaymentsForUser(u));
        } catch (DataAccessException ex) {
            return ResponseEntity.status(503).body(Map.of("message", "Module abonnement non initialisé"));
        }
    }

    @PostMapping("/payments/initiate")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> initiatePayment(@RequestBody(required = false) InitiatePaymentRequest req) {
        Utilisateur u = getCurrentUserOrNull();
        if (u == null) return ResponseEntity.status(401).body(Map.of("message", "Authentification requise"));
        try {
            String planCode = req != null ? req.planCode : null;
            String provider = req != null ? req.provider : null;
            return ResponseEntity.ok(subscriptionPaymentService.initiatePayment(u, planCode, provider));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        } catch (DataAccessException ex) {
            return ResponseEntity.status(503).body(Map.of("message", "Module abonnement non initialisé"));
        }
    }

    @PostMapping("/payments/manual-submit")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> manualSubmitPayment(
            @RequestParam("planCode") String planCode,
            @RequestParam(value = "modePaiement", required = false) String modePaiement,
            @RequestParam(value = "transactionRef", required = false) String transactionRef,
            @RequestParam(value = "ownerNote", required = false) String ownerNote,
            @RequestParam("receipt") MultipartFile receipt
    ) {
        Utilisateur u = getCurrentUserOrNull();
        if (u == null) return ResponseEntity.status(401).body(Map.of("message", "Authentification requise"));
        try {
            if (receipt == null || receipt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "La preuve de paiement est obligatoire"));
            }

            String originalName = receipt.getOriginalFilename() == null ? "receipt.jpg" : receipt.getOriginalFilename();
            String ext = originalName.contains(".") ? originalName.substring(originalName.lastIndexOf('.')).toLowerCase() : ".jpg";
            if (!List.of(".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif").contains(ext)) {
                ext = ".jpg";
            }
            String fileName = "sub_receipt_" + UUID.randomUUID() + ext;

            Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("subscription_receipts");
            Files.createDirectories(uploadPath);
            Path destination = uploadPath.resolve(fileName).normalize();

            if (!destination.startsWith(uploadPath)) {
                logger.warn("Rejected suspicious receipt path for user {}: {}", u.getId(), destination);
                return ResponseEntity.badRequest().body(Map.of("message", "Nom de fichier invalide"));
            }

            try (var in = receipt.getInputStream()) {
                Files.copy(in, destination, StandardCopyOption.REPLACE_EXISTING);
            }

            // Render fallback mount path if primary write unexpectedly fails later in runtime changes
            if (!Files.exists(destination) || !Files.isReadable(destination)) {
                Path fallbackPath = Paths.get("/app/uploads/subscription_receipts").toAbsolutePath().normalize();
                Files.createDirectories(fallbackPath);
                Path fallbackDest = fallbackPath.resolve(fileName).normalize();
                try (var in = receipt.getInputStream()) {
                    Files.copy(in, fallbackDest, StandardCopyOption.REPLACE_EXISTING);
                }
                logger.info("Saved subscription receipt via fallback path for user {} -> {}", u.getId(), fallbackDest);
            } else {
                logger.info("Saved subscription receipt for user {} -> {}", u.getId(), destination);
            }

            String preuveUrl = "/uploads/subscription_receipts/" + fileName;

            return ResponseEntity.ok(
                    subscriptionPaymentService.submitManualPayment(
                            u,
                            planCode,
                            modePaiement,
                            transactionRef,
                            ownerNote,
                            preuveUrl
                    )
            );
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        } catch (Exception ex) {
            logger.error("manual-submit failed for user {}: {}", u.getId(), ex.getMessage(), ex);
            return ResponseEntity.status(500).body(Map.of("message", "Impossible de soumettre la preuve de paiement"));
        }
    }

    @PostMapping("/payments/{paymentId}/simulate-success")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> simulateSuccess(@PathVariable Long paymentId) {
        Utilisateur u = getCurrentUserOrNull();
        if (u == null) return ResponseEntity.status(401).body(Map.of("message", "Authentification requise"));
        try {
            return ResponseEntity.ok(subscriptionPaymentService.simulateSuccess(u, paymentId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        } catch (DataAccessException ex) {
            return ResponseEntity.status(503).body(Map.of("message", "Module abonnement non initialisé"));
        }
    }

    public static class InitiatePaymentRequest {
        public String planCode;
        public String provider;
    }
}
