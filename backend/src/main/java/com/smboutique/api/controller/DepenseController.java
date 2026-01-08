package com.smboutique.api.controller;

import com.smboutique.api.model.Depense;
import com.smboutique.api.service.DepenseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/depenses")
@CrossOrigin(origins = "*")
public class DepenseController {

    @Autowired
    private DepenseService depenseService;

    @Autowired
    private com.smboutique.api.service.UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.repository.CaisseRepository caisseRepository;

    @Autowired
    private com.smboutique.api.service.CaisseService caisseService;

    @Autowired
    private com.smboutique.api.service.CaisseTransactionService caisseTransactionService;

    @Autowired
    private com.smboutique.api.service.CaisseMovementService caisseMovementService;

    @Autowired
    private com.smboutique.api.service.NotificationService notificationService;

    @Autowired
    private com.smboutique.api.service.PdfService pdfService;

    @Autowired
    private com.smboutique.api.service.MouvementService mouvementService;

    private boolean isSuperAdmin(com.smboutique.api.model.Utilisateur user) {
        if (user == null) return false;
        return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
    }

    @GetMapping
    public ResponseEntity<?> listDepenses(@RequestParam(required = false) Long boutiqueId,
                                          @RequestParam(required = false) String status) {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        com.smboutique.api.model.Utilisateur user = utilisateurService.findByEmail(auth.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        boolean isSuper = isSuperAdmin(user);
        if (!isSuper && !utilisateurService.hasPermission(user, "DEPENSE_LECTURE")) return ResponseEntity.status(403).body(java.util.Map.of("error", "Permission DEPENSE_LECTURE requise"));

        Long bId = boutiqueId != null ? boutiqueId : (user.getBoutique() != null ? user.getBoutique().getId() : null);
        if (bId == null) return ResponseEntity.badRequest().body(java.util.Map.of("error", "Boutique requise"));

        java.util.List<Depense> list;
        if (status != null && !status.isBlank()) {
            try {
                com.smboutique.api.model.DepenseStatus st = com.smboutique.api.model.DepenseStatus.valueOf(status);
                list = depenseService.findByStatusAndBoutiqueId(st, bId);
            } catch (Exception ex) {
                return ResponseEntity.badRequest().body(java.util.Map.of("error", "Statut invalide"));
            }
        } else {
            list = depenseService.findByBoutiqueId(bId);
        }
        return ResponseEntity.ok(list);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getDepenseById(@PathVariable Long id) {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        com.smboutique.api.model.Utilisateur user = utilisateurService.findByEmail(auth.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "DEPENSE_LECTURE")) return ResponseEntity.status(403).body(java.util.Map.of("error", "Permission DEPENSE_LECTURE requise"));

        return depenseService.findById(id).map(d -> ResponseEntity.ok(d)).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createDepense(@RequestBody Depense depense) {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        com.smboutique.api.model.Utilisateur user = utilisateurService.findByEmail(auth.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        boolean isSuper = isSuperAdmin(user);
        if (!isSuper && !utilisateurService.hasPermission(user, "DEPENSE_CREER")) return ResponseEntity.status(403).body(java.util.Map.of("error", "Permission DEPENSE_CREER requise"));

        if (depense.getMontant() == null || depense.getMontant() <= 0) return ResponseEntity.badRequest().body(java.util.Map.of("error", "Montant invalide"));

        depense.setStatus(com.smboutique.api.model.DepenseStatus.EN_ATTENTE);
        depense.setCreateurId(user.getId());
        depense.setBoutiqueId(user.getBoutique() != null ? user.getBoutique().getId() : null);
        depense.setCreatedAt(java.time.LocalDateTime.now());
        if (depense.getReference() == null || depense.getReference().isBlank()) {
            depense.setReference("DEP-" + java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmmss")));
        }
        Depense saved = depenseService.save(depense);

        // Notify users in the boutique who can validate dépenses
        try {
            String payload = "Dépense créée: " + saved.getReference() + " (" + saved.getMontant() + ")";
            notificationService.createForBoutiqueUsersWithPermission(saved.getBoutiqueId(), "DEPENSE_VALIDATION", "DEPENSE_CREATED", payload);
        } catch (Exception ex) {
            // don't fail creation if notifications fail
            System.err.println("Warning: failed to create notification for depense: " + ex.getMessage());
        }

        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateDepense(@PathVariable Long id, @RequestBody Depense depenseDetails) {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        com.smboutique.api.model.Utilisateur user = utilisateurService.findByEmail(auth.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "DEPENSE_CREER")) return ResponseEntity.status(403).body(java.util.Map.of("error", "Permission DEPENSE_CREER requise"));

        return depenseService.findById(id)
                .map(depense -> {
                    // Only allow edit when EN_ATTENTE
                    if (depense.getStatus() != com.smboutique.api.model.DepenseStatus.EN_ATTENTE) {
                        return ResponseEntity.status(400).body(java.util.Map.of("error", "Impossible de modifier une dépense validée/rejetée/annulée"));
                    }
                    depense.setReferenceCaisse(depenseDetails.getReferenceCaisse());
                    depense.setLibelle(depenseDetails.getLibelle());
                    depense.setMontant(depenseDetails.getMontant());
                    depense.setDate(depenseDetails.getDate());
                    depense.setNote(depenseDetails.getNote());
                    return ResponseEntity.ok(depenseService.save(depense));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDepense(@PathVariable Long id) {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        com.smboutique.api.model.Utilisateur user = utilisateurService.findByEmail(auth.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "DEPENSE_CREER")) return ResponseEntity.status(403).body(java.util.Map.of("error", "Permission DEPENSE_CREER requise"));

        return depenseService.findById(id)
                .map(depense -> {
                    if (depense.getStatus() != com.smboutique.api.model.DepenseStatus.EN_ATTENTE) {
                        return ResponseEntity.status(400).body(java.util.Map.of("error", "Impossible de supprimer une dépense validée/rejetée/annulée"));
                    }
                    depenseService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // --- Validation (create SORTIE movement, decrement caisse) ---
    @PostMapping("/{id}/validate")
    @Transactional
    public ResponseEntity<?> validateDepense(@PathVariable Long id, @RequestBody(required = false) java.util.Map<String, String> body) {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        com.smboutique.api.model.Utilisateur user = utilisateurService.findByEmail(auth.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "DEPENSE_VALIDATION")) return ResponseEntity.status(403).body(java.util.Map.of("error", "Permission DEPENSE_VALIDATION requise"));

        String refCaisseFromReq = body != null ? body.getOrDefault("referenceCaisse", null) : null;

        try {
            Depense dep = depenseService.findById(id).orElse(null);
            if (dep == null) return ResponseEntity.notFound().build();
            if (dep.getStatus() != com.smboutique.api.model.DepenseStatus.EN_ATTENTE) return ResponseEntity.badRequest().body(java.util.Map.of("error", "Seules les dépenses en EN_ATTENTE peuvent être validées"));

            String refC = refCaisseFromReq != null && !refCaisseFromReq.isBlank() ? refCaisseFromReq : dep.getReferenceCaisse();
            if (refC == null || refC.isBlank()) return ResponseEntity.badRequest().body(java.util.Map.of("error", "Référence de caisse requise pour validation"));

            // find caisse scoped to boutique
            Long bId = dep.getBoutiqueId();
            java.util.Optional<com.smboutique.api.model.Caisse> maybe = caisseRepository.findFirstByReferenceAndBoutiqueIdOrderByIdDesc(refC, bId);
            if (maybe.isEmpty()) {
                java.util.List<com.smboutique.api.model.Caisse> all = caisseRepository.findAllByReference(refC);
                if (all.size() > 1) return ResponseEntity.badRequest().body(java.util.Map.of("error", "Référence de caisse ambiguë"));
                return ResponseEntity.badRequest().body(java.util.Map.of("error", "Caisse introuvable pour la référence fournie"));
            }
            com.smboutique.api.model.Caisse caisse = maybe.get();
            String sRef = caisse.getStatut() == null ? "" : caisse.getStatut().toUpperCase();
            if (!(sRef.contains("OUVERTE") || sRef.contains("OPEN") || sRef.contains("ACT"))) {
                return ResponseEntity.badRequest().body(java.util.Map.of("error", "La caisse sélectionnée n'est pas ouverte"));
            }

            int montant = dep.getMontant() != null ? dep.getMontant() : 0;
            Integer cur = caisse.getMontantTotal() != null ? caisse.getMontantTotal() : 0;
            if (montant > cur) return ResponseEntity.badRequest().body(java.util.Map.of("error", "Solde insuffisant pour valider cette dépense"));

            // update caisse
            int before = cur;
            caisse.setMontantTotal(cur - montant);
            caisse = caisseService.save(caisse);

            // record transaction
            com.smboutique.api.model.CaisseTransaction tx = new com.smboutique.api.model.CaisseTransaction();
            tx.setType(com.smboutique.api.model.CaisseTransaction.TransactionType.DEBIT);
            tx.setMontant(montant);
            tx.setPaiementId(null);
            tx.setCommandeId(null);
            tx.setUserId(user.getId());
            tx.setReferenceCaisse(refC);
            tx.setBoutiqueId(dep.getBoutiqueId());
            tx.setRaison("Validation dépense " + dep.getReference());
            caisseTransactionService.save(tx);

            // record movement
            com.smboutique.api.model.CaisseMovement mv = new com.smboutique.api.model.CaisseMovement();
            mv.setType(com.smboutique.api.model.CaisseMovement.MovementType.DEPENSE);
            mv.setMontant(montant);
            mv.setBalanceBefore(before);
            mv.setBalanceAfter(caisse.getMontantTotal());
            mv.setDepenseId(dep.getId());
            mv.setUserId(user.getId());
            mv.setReferenceCaisse(refC);
            mv.setBoutiqueId(dep.getBoutiqueId());
            mv.setRaison("Dépense validée: " + (dep.getLibelle() != null ? dep.getLibelle() : dep.getReference()));
            caisseMovementService.save(mv);

            // update depense status and validator
            dep.setStatus(com.smboutique.api.model.DepenseStatus.VALIDEE);
            dep.setValidatorId(user.getId());
            dep.setValidatedAt(java.time.LocalDateTime.now());
            dep.setReferenceCaisse(refC);
            depenseService.save(dep);

            return ResponseEntity.ok(dep);
        } catch (org.springframework.dao.DataAccessException ex) {
            try { org.springframework.transaction.interceptor.TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Exception t) {}
            return ResponseEntity.status(500).body(java.util.Map.of("error", "Erreur serveur lors de la validation"));
        } catch (Exception ex) {
            try { org.springframework.transaction.interceptor.TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Exception t) {}
            return ResponseEntity.status(500).body(java.util.Map.of("error", "Erreur interne"));
        }
    }

    // --- Reject ---
    @PostMapping("/{id}/reject")
    public ResponseEntity<?> rejectDepense(@PathVariable Long id) {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        com.smboutique.api.model.Utilisateur user = utilisateurService.findByEmail(auth.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "DEPENSE_VALIDATION")) return ResponseEntity.status(403).body(java.util.Map.of("error", "Permission DEPENSE_VALIDATION requise"));

        return depenseService.findById(id)
                .map(depense -> {
                    if (depense.getStatus() != com.smboutique.api.model.DepenseStatus.EN_ATTENTE) {
                        return ResponseEntity.status(400).body(java.util.Map.of("error", "Seules les dépenses en EN_ATTENTE peuvent être rejetées"));
                    }
                    depense.setStatus(com.smboutique.api.model.DepenseStatus.REJETEE);
                    depense.setValidatorId(user.getId());
                    depense.setValidatedAt(java.time.LocalDateTime.now());
                    depenseService.save(depense);
                    return ResponseEntity.ok(depense);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // --- PDF ---
    @GetMapping("/{id}/pdf")
    public void getDepensePdf(@PathVariable Long id, jakarta.servlet.http.HttpServletResponse response) throws java.io.IOException {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) { response.sendError(403, "Accès refusé"); return; }
        com.smboutique.api.model.Utilisateur user = utilisateurService.findByEmail(auth.getName()).orElse(null);
        if (user == null) { response.sendError(403, "Accès refusé"); return; }
        boolean isSuper = isSuperAdmin(user);
        if (!isSuper && !utilisateurService.hasPermission(user, "DEPENSE_LECTURE")) { response.sendError(403, "Permission DEPENSE_LECTURE requise"); return; }

        pdfService.writeDepensePdf(id, response);
        try {
            Long userId = null;
            try {
                var auth2 = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                if (auth2 != null && auth2.getName() != null) {
                    var u = utilisateurService.findByEmail(auth2.getName()).orElse(null);
                    if (u != null) userId = u.getId();
                }
            } catch (Exception ignore) {}
            var dopt = depenseService.findById(id);
            if (dopt.isPresent()) {
                var dep = dopt.get();
                Long boutiqueId = dep.getBoutiqueId();
                Double montant = dep.getMontant() != null ? Double.valueOf(dep.getMontant()) : null;
                mouvementService.log("DOCUMENT", "DEPENSE_PDF", "Génération PDF - DEPENSE", id, boutiqueId, null, userId, montant);
            }
        } catch (Exception ignore) {}
    }

    // --- Cancel ---
    @PostMapping("/{id}/cancel")
    @Transactional
    public ResponseEntity<?> cancelDepense(@PathVariable Long id, @RequestBody(required = false) java.util.Map<String, String> body) {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        com.smboutique.api.model.Utilisateur user = utilisateurService.findByEmail(auth.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "DEPENSE_ANNULATION")) return ResponseEntity.status(403).body(java.util.Map.of("error", "Permission DEPENSE_ANNULATION requise"));

        String reason = body != null ? body.getOrDefault("reason", "Annulation dépense") : "Annulation dépense";

        try {
            Depense dep = depenseService.findById(id).orElse(null);
            if (dep == null) return ResponseEntity.notFound().build();
            if (dep.getStatus() != com.smboutique.api.model.DepenseStatus.VALIDEE) return ResponseEntity.badRequest().body(java.util.Map.of("error", "Seules les dépenses validées peuvent être annulées"));

            String refC = dep.getReferenceCaisse();
            if (refC == null || refC.isBlank()) return ResponseEntity.badRequest().body(java.util.Map.of("error", "Dépense validée sans référence de caisse — annulation impossible"));

            Long bId = dep.getBoutiqueId();
            java.util.Optional<com.smboutique.api.model.Caisse> maybe = caisseRepository.findFirstByReferenceAndBoutiqueIdOrderByIdDesc(refC, bId);
            if (maybe.isEmpty()) return ResponseEntity.badRequest().body(java.util.Map.of("error", "Caisse introuvable pour la référence"));
            com.smboutique.api.model.Caisse caisse = maybe.get();

            // increment caisse
            Integer cur = caisse.getMontantTotal() != null ? caisse.getMontantTotal() : 0;
            Integer before = cur;
            caisse.setMontantTotal(cur + (dep.getMontant() != null ? dep.getMontant() : 0));
            caisse = caisseService.save(caisse);

            // record reversal tx
            com.smboutique.api.model.CaisseTransaction tx = new com.smboutique.api.model.CaisseTransaction();
            tx.setType(com.smboutique.api.model.CaisseTransaction.TransactionType.REVERSAL);
            tx.setMontant(dep.getMontant() != null ? dep.getMontant() : 0);
            tx.setPaiementId(null);
            tx.setCommandeId(null);
            tx.setUserId(user.getId());
            tx.setReferenceCaisse(refC);
            tx.setBoutiqueId(dep.getBoutiqueId());
            tx.setRaison(reason);
            caisseTransactionService.save(tx);

            // record movement reversal
            com.smboutique.api.model.CaisseMovement mv = new com.smboutique.api.model.CaisseMovement();
            mv.setType(com.smboutique.api.model.CaisseMovement.MovementType.REVERSAL);
            mv.setMontant(dep.getMontant() != null ? dep.getMontant() : 0);
            mv.setBalanceBefore(before);
            mv.setBalanceAfter(caisse.getMontantTotal());
            mv.setDepenseId(dep.getId());
            mv.setUserId(user.getId());
            mv.setReferenceCaisse(refC);
            mv.setBoutiqueId(dep.getBoutiqueId());
            mv.setRaison(reason);
            caisseMovementService.save(mv);

            dep.setStatus(com.smboutique.api.model.DepenseStatus.ANNULEE);
            dep.setAnnulePar(user.getId());
            dep.setAnnuleAt(java.time.LocalDateTime.now());
            dep.setAnnuleReason(reason);
            depenseService.save(dep);

            return ResponseEntity.ok(dep);
        } catch (org.springframework.dao.DataAccessException ex) {
            try { org.springframework.transaction.interceptor.TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Exception t) {}
            return ResponseEntity.status(500).body(java.util.Map.of("error", "Erreur serveur lors de l'annulation"));
        } catch (Exception ex) {
            try { org.springframework.transaction.interceptor.TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Exception t) {}
            return ResponseEntity.status(500).body(java.util.Map.of("error", "Erreur interne"));
        }
    }
}
