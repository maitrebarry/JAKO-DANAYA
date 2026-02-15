package com.smboutique.api.service.impl;

import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.UtilisateurRepository;
import com.smboutique.api.service.NotificationService;
import com.smboutique.api.service.SubscriptionPaymentService;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class SubscriptionPaymentServiceImpl implements SubscriptionPaymentService {

    private final JdbcTemplate jdbcTemplate;
    private final NotificationService notificationService;
    private final UtilisateurRepository utilisateurRepository;

    public SubscriptionPaymentServiceImpl(JdbcTemplate jdbcTemplate,
                                          NotificationService notificationService,
                                          UtilisateurRepository utilisateurRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.notificationService = notificationService;
        this.utilisateurRepository = utilisateurRepository;
    }

    @Override
    public List<Map<String, Object>> listPaymentsForUser(Utilisateur user) {
        if (user == null || user.getBoutique() == null) return List.of();
        return jdbcTemplate.queryForList(
                "SELECT ap.id, ap.reference, ap.provider, ap.mode_paiement, ap.plan_code, ap.transaction_ref, ap.owner_note, ap.preuve_url, ap.review_note, ap.montant, ap.devise, ap.statut, ap.paid_at, ap.created_at, ap.reviewed_at " +
                        "FROM abonnement_paiement ap " +
                        "JOIN abonnement_boutique ab ON ab.id = ap.abonnement_id " +
                        "WHERE ab.boutique_id = ? " +
                        "ORDER BY ap.id DESC",
                user.getBoutique().getId()
        );
    }

        private Map<String, String> manualPaymentNumbers() {
                Map<String, String> nums = new HashMap<>();
                nums.put("ORANGE_MONEY", "74745669");
                nums.put("WAVE", "74745669");
                nums.put("MOBICASH", "67205736");
                // backward compatibility keys
                nums.put("ORANGE", "74745669");
                nums.put("MTN", "67205736");
                return nums;
        }

    @Override
    public List<Map<String, Object>> listPaymentsForAdmin(String status) {
        String normalizedStatus = status == null ? null : status.trim().toUpperCase();
        if (normalizedStatus == null || normalizedStatus.isBlank()) {
            return jdbcTemplate.queryForList(
                    "SELECT ap.id, ap.reference, ap.provider, ap.mode_paiement, ap.plan_code, ap.transaction_ref, ap.owner_note, ap.preuve_url, ap.review_note, ap.montant, ap.devise, ap.statut, ap.paid_at, ap.created_at, ap.reviewed_at, b.id_boutique AS boutique_id, b.nom AS boutique_nom " +
                            "FROM abonnement_paiement ap " +
                            "JOIN abonnement_boutique ab ON ab.id = ap.abonnement_id " +
                            "JOIN boutique b ON b.id_boutique = ab.boutique_id " +
                            "ORDER BY ap.id DESC"
            );
        }
        return jdbcTemplate.queryForList(
                "SELECT ap.id, ap.reference, ap.provider, ap.mode_paiement, ap.plan_code, ap.transaction_ref, ap.owner_note, ap.preuve_url, ap.review_note, ap.montant, ap.devise, ap.statut, ap.paid_at, ap.created_at, ap.reviewed_at, b.id_boutique AS boutique_id, b.nom AS boutique_nom " +
                        "FROM abonnement_paiement ap " +
                        "JOIN abonnement_boutique ab ON ab.id = ap.abonnement_id " +
                        "JOIN boutique b ON b.id_boutique = ab.boutique_id " +
                        "WHERE UPPER(ap.statut) = ? " +
                        "ORDER BY ap.id DESC",
                normalizedStatus
        );
    }

    @Override
    @Transactional
    public Map<String, Object> submitManualPayment(Utilisateur user,
                                                   String planCode,
                                                   String modePaiement,
                                                   String transactionRef,
                                                   String ownerNote,
                                                   String preuveUrl) {
        if (user == null || user.getBoutique() == null) {
            throw new IllegalArgumentException("Utilisateur ou boutique introuvable");
        }
        if (preuveUrl == null || preuveUrl.isBlank()) {
            throw new IllegalArgumentException("La preuve de paiement est obligatoire");
        }

        String normalizedPlanCode = (planCode == null || planCode.isBlank()) ? "MENSUEL" : planCode.trim().toUpperCase();
        String normalizedMode = (modePaiement == null || modePaiement.isBlank()) ? "MANUEL" : modePaiement.trim().toUpperCase();
        if (!List.of("ORANGE_MONEY", "WAVE", "MOBICASH", "MANUEL").contains(normalizedMode)) {
            throw new IllegalArgumentException("Mode de paiement invalide");
        }

        List<Map<String, Object>> plans = jdbcTemplate.queryForList(
                "SELECT id, code, libelle, prix, devise FROM abonnement_plan WHERE code = ? AND actif = TRUE LIMIT 1",
                normalizedPlanCode
        );
        if (plans.isEmpty()) {
            throw new IllegalArgumentException("Plan introuvable: " + normalizedPlanCode);
        }

        Long boutiqueId = user.getBoutique().getId();
        List<Map<String, Object>> anchors = jdbcTemplate.queryForList(
                "SELECT id FROM abonnement_boutique WHERE boutique_id = ? ORDER BY id DESC LIMIT 1",
                boutiqueId
        );
        if (anchors.isEmpty()) {
            throw new IllegalArgumentException("Aucun abonnement de base trouvé pour cette boutique");
        }

        List<Map<String, Object>> existingPending = jdbcTemplate.queryForList(
                "SELECT ap.id, ap.reference, ap.provider, ap.mode_paiement, ap.plan_code, ap.montant, ap.devise, ap.statut " +
                        "FROM abonnement_paiement ap " +
                        "JOIN abonnement_boutique ab ON ab.id = ap.abonnement_id " +
                        "WHERE ab.boutique_id = ? AND ap.statut = 'PENDING' " +
                        "ORDER BY ap.id DESC LIMIT 1",
                boutiqueId
        );
        if (!existingPending.isEmpty()) {
            Map<String, Object> row = existingPending.get(0);
            return Map.of(
                    "paymentId", ((Number) row.get("id")).longValue(),
                    "reference", row.get("reference"),
                    "status", row.get("statut"),
                    "message", "Une demande de paiement est déjà en attente de validation.",
                    "manualPaymentNumbers", manualPaymentNumbers()
            );
        }

        Long abonnementAnchorId = ((Number) anchors.get(0).get("id")).longValue();
        String reference = "SUB-" + boutiqueId + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase();
        Number montantN = (Number) plans.get(0).get("prix");
        String devise = String.valueOf(plans.get(0).get("devise"));

        Number paymentIdN;
        try {
            paymentIdN = jdbcTemplate.queryForObject(
                    "INSERT INTO abonnement_paiement (abonnement_id, reference, provider, mode_paiement, plan_code, transaction_ref, owner_note, preuve_url, montant, devise, statut, paid_at, created_at) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL, now()) RETURNING id",
                    Number.class,
                    abonnementAnchorId,
                    reference,
                    normalizedMode,
                    normalizedMode,
                    normalizedPlanCode,
                    (transactionRef == null || transactionRef.isBlank()) ? null : transactionRef.trim(),
                    (ownerNote == null || ownerNote.isBlank()) ? null : ownerNote.trim(),
                    preuveUrl,
                    montantN,
                    devise
            );
        } catch (DataAccessException ex) {
            // Backward compatibility for production environments where optional columns
            // (transaction_ref, owner_note, preuve_url, etc.) may not yet exist.
            paymentIdN = jdbcTemplate.queryForObject(
                    "INSERT INTO abonnement_paiement (abonnement_id, reference, provider, mode_paiement, plan_code, montant, devise, statut, paid_at, created_at) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL, now()) RETURNING id",
                    Number.class,
                    abonnementAnchorId,
                    reference,
                    normalizedMode,
                    normalizedMode,
                    normalizedPlanCode,
                    montantN,
                    devise
            );

            // Try to persist optional metadata if columns exist; ignore if not available.
            try {
                jdbcTemplate.update(
                        "UPDATE abonnement_paiement SET transaction_ref = ?, owner_note = ?, preuve_url = ? WHERE id = ?",
                        (transactionRef == null || transactionRef.isBlank()) ? null : transactionRef.trim(),
                        (ownerNote == null || ownerNote.isBlank()) ? null : ownerNote.trim(),
                        preuveUrl,
                        paymentIdN != null ? paymentIdN.longValue() : null
                );
            } catch (Exception ignored) {
                // Optional fields unavailable in legacy schema.
            }
        }

        if (paymentIdN == null) throw new IllegalStateException("Création du paiement impossible");

        return Map.of(
                "paymentId", paymentIdN.longValue(),
                "reference", reference,
                "status", "PENDING",
                "manualPaymentNumbers", manualPaymentNumbers(),
                "message", "Demande envoyée au SuperAdmin pour validation."
        );
    }

    @Override
    @Transactional
    public Map<String, Object> initiatePayment(Utilisateur user, String planCode, String provider) {
        if (user == null || user.getBoutique() == null) {
            throw new IllegalArgumentException("Utilisateur ou boutique introuvable");
        }

        String normalizedPlanCode = (planCode == null || planCode.isBlank()) ? "MENSUEL" : planCode.trim().toUpperCase();
        String normalizedProvider = (provider == null || provider.isBlank()) ? "MANUEL" : provider.trim().toUpperCase();
        String modePaiement = "MANUEL";

        List<Map<String, Object>> plans = jdbcTemplate.queryForList(
                "SELECT id, code, libelle, prix, devise FROM abonnement_plan WHERE code = ? AND actif = TRUE LIMIT 1",
                normalizedPlanCode
        );
        if (plans.isEmpty()) {
            throw new IllegalArgumentException("Plan introuvable: " + normalizedPlanCode);
        }

        Long boutiqueId = user.getBoutique().getId();

        // éviter les doublons de demandes manuelles en attente
        List<Map<String, Object>> existingPending = jdbcTemplate.queryForList(
                "SELECT ap.id, ap.reference, ap.provider, ap.mode_paiement, ap.plan_code, ap.montant, ap.devise, ap.statut " +
                        "FROM abonnement_paiement ap " +
                        "JOIN abonnement_boutique ab ON ab.id = ap.abonnement_id " +
                        "WHERE ab.boutique_id = ? AND ap.statut = 'PENDING' " +
                        "ORDER BY ap.id DESC LIMIT 1",
                boutiqueId
        );
        if (!existingPending.isEmpty()) {
            Map<String, Object> row = existingPending.get(0);
            Map<String, Object> out = new HashMap<>();
            out.put("paymentId", ((Number) row.get("id")).longValue());
            out.put("reference", row.get("reference"));
            out.put("provider", row.get("provider"));
            out.put("modePaiement", row.get("mode_paiement") != null ? row.get("mode_paiement") : modePaiement);
            out.put("planCode", row.get("plan_code"));
            out.put("amount", row.get("montant"));
            out.put("currency", row.get("devise"));
            out.put("status", row.get("statut"));
            out.put("manualPaymentNumbers", manualPaymentNumbers());
            out.put("message", "Une demande de paiement est déjà en attente de validation.");
            return out;
        }

        List<Map<String, Object>> anchors = jdbcTemplate.queryForList(
                "SELECT id FROM abonnement_boutique WHERE boutique_id = ? ORDER BY id DESC LIMIT 1",
                boutiqueId
        );
        if (anchors.isEmpty()) {
            throw new IllegalArgumentException("Aucun abonnement de base trouvé pour cette boutique");
        }

        Long abonnementAnchorId = ((Number) anchors.get(0).get("id")).longValue();
        String reference = "SUB-" + boutiqueId + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase();

        Number montantN = (Number) plans.get(0).get("prix");
        String devise = String.valueOf(plans.get(0).get("devise"));

        Number paymentIdN = jdbcTemplate.queryForObject(
                "INSERT INTO abonnement_paiement (abonnement_id, reference, provider, mode_paiement, plan_code, montant, devise, statut, paid_at, created_at) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL, now()) RETURNING id",
                Number.class,
                abonnementAnchorId,
                reference,
                normalizedProvider,
                modePaiement,
                normalizedPlanCode,
                montantN,
                devise
        );

        if (paymentIdN == null) throw new IllegalStateException("Création du paiement impossible");

        Map<String, Object> out = new HashMap<>();
        out.put("paymentId", paymentIdN.longValue());
        out.put("reference", reference);
        out.put("provider", normalizedProvider);
                out.put("modePaiement", modePaiement);
        out.put("planCode", normalizedPlanCode);
        out.put("amount", montantN);
        out.put("currency", devise);
        out.put("status", "PENDING");
                out.put("manualPaymentNumbers", manualPaymentNumbers());
                out.put("message", "Demande de paiement créée. Effectuez le paiement Mobile Money puis attendez la validation SuperAdmin.");
        return out;
    }

    @Override
    @Transactional
    public Map<String, Object> simulateSuccess(Utilisateur user, Long paymentId) {
        if (user == null || paymentId == null) {
            throw new IllegalArgumentException("Paramètres invalides");
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT ap.id, ap.reference, ap.provider, ap.plan_code, ap.montant, ap.devise, ap.statut, " +
                        "ab.boutique_id, ab.id AS abonnement_anchor_id " +
                        "FROM abonnement_paiement ap " +
                        "JOIN abonnement_boutique ab ON ab.id = ap.abonnement_id " +
                        "WHERE ap.id = ?",
                paymentId
        );
        if (rows.isEmpty()) throw new IllegalArgumentException("Paiement introuvable");

        Map<String, Object> payment = rows.get(0);
        Long boutiqueId = ((Number) payment.get("boutique_id")).longValue();

        boolean isSuperAdmin = user.getRoles() != null && user.getRoles().stream()
                .anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()) || "ROLE_SUPERADMIN".equalsIgnoreCase(r.getName()));
                if (!isSuperAdmin) {
                        throw new IllegalArgumentException("Accès réservé au superadmin");
        }

        String currentStatus = String.valueOf(payment.get("statut"));
        if (!"PAID".equalsIgnoreCase(currentStatus)) {
            jdbcTemplate.update(
                    "UPDATE abonnement_paiement SET statut = 'PAID', paid_at = now(), reviewed_by = ?, reviewed_at = now(), review_note = NULL WHERE id = ?",
                    user.getId(),
                    paymentId
            );
        }

        String planCode = payment.get("plan_code") != null ? String.valueOf(payment.get("plan_code")).toUpperCase() : "MENSUEL";
        List<Map<String, Object>> plans = jdbcTemplate.queryForList(
                "SELECT id, duree_mois, libelle FROM abonnement_plan WHERE code = ? AND actif = TRUE LIMIT 1",
                planCode
        );
        if (plans.isEmpty()) throw new IllegalArgumentException("Plan introuvable: " + planCode);

        Long planId = ((Number) plans.get(0).get("id")).longValue();
        Integer dureeMois = ((Number) plans.get(0).get("duree_mois")).intValue();
        String planLibelle = String.valueOf(plans.get(0).get("libelle"));

        Timestamp latestActiveFinTs = jdbcTemplate.queryForObject(
                "SELECT MAX(date_fin) FROM abonnement_boutique WHERE boutique_id = ? AND statut = 'ACTIVE'",
                Timestamp.class,
                boutiqueId
        );

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startAt = now;
        if (latestActiveFinTs != null) {
            LocalDateTime latestFin = latestActiveFinTs.toLocalDateTime();
            if (latestFin.isAfter(now)) startAt = latestFin;
        }
        LocalDateTime endAt = startAt.plusMonths(dureeMois);

        Number newAbonnementIdN = jdbcTemplate.queryForObject(
                "INSERT INTO abonnement_boutique (boutique_id, plan_id, statut, date_debut, date_fin, grace_end_at, auto_renew, created_at, updated_at) " +
                        "VALUES (?, ?, 'ACTIVE', ?, ?, NULL, FALSE, now(), now()) RETURNING id",
                Number.class,
                boutiqueId,
                planId,
                Timestamp.valueOf(startAt),
                Timestamp.valueOf(endAt)
        );

        // Notification cloche pour les utilisateurs de la boutique (au minimum propriétaires)
        var users = utilisateurRepository.findByBoutiqueId(boutiqueId);
        for (var u : users) {
            String msg = "Paiement abonnement confirmé (" + planLibelle + ") - échéance au " + endAt.toLocalDate();
            notificationService.createForUser(u.getId(), boutiqueId, "ABONNEMENT", msg);
        }

        Map<String, Object> out = new HashMap<>();
        out.put("ok", true);
        out.put("paymentId", paymentId);
        out.put("newAbonnementId", newAbonnementIdN != null ? newAbonnementIdN.longValue() : null);
        out.put("status", "PAID");
        out.put("startAt", startAt);
        out.put("endAt", endAt);
        return out;
    }

        @Override
        @Transactional
        public Map<String, Object> rejectPayment(Utilisateur user, Long paymentId, String reason) {
                if (user == null || paymentId == null) throw new IllegalArgumentException("Paramètres invalides");

                boolean isSuperAdmin = user.getRoles() != null && user.getRoles().stream()
                                .anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()) || "ROLE_SUPERADMIN".equalsIgnoreCase(r.getName()));
                if (!isSuperAdmin) throw new IllegalArgumentException("Accès réservé au superadmin");

                List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                                "SELECT ap.id, ap.statut, ab.boutique_id FROM abonnement_paiement ap " +
                                                "JOIN abonnement_boutique ab ON ab.id = ap.abonnement_id " +
                                                "WHERE ap.id = ?",
                                paymentId
                );
                if (rows.isEmpty()) throw new IllegalArgumentException("Paiement introuvable");
                String statut = String.valueOf(rows.get(0).get("statut"));
                Long boutiqueId = ((Number) rows.get(0).get("boutique_id")).longValue();

                if (!"PENDING".equalsIgnoreCase(statut)) {
                        throw new IllegalArgumentException("Seuls les paiements PENDING peuvent être rejetés");
                }

                jdbcTemplate.update(
                        "UPDATE abonnement_paiement SET statut = 'FAILED', reviewed_by = ?, reviewed_at = now(), review_note = ? WHERE id = ?",
                        user.getId(),
                        (reason == null || reason.isBlank()) ? null : reason.trim(),
                        paymentId
                );

                var users = utilisateurRepository.findByBoutiqueId(boutiqueId);
                String msg = "Paiement abonnement rejeté" + (reason != null && !reason.isBlank() ? (" : " + reason.trim()) : "");
                for (var u : users) {
                        notificationService.createForUser(u.getId(), boutiqueId, "ABONNEMENT", msg);
                }

                return Map.of("ok", true, "paymentId", paymentId, "status", "FAILED");
        }
}
