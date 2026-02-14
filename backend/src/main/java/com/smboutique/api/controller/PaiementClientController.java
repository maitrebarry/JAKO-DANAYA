package com.smboutique.api.controller;

import com.smboutique.api.model.PaiementClient;
import com.smboutique.api.service.PaiementClientService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/paiements-clients")
@CrossOrigin(origins = "*")
public class PaiementClientController {

    @Autowired
    private PaiementClientService paiementClientService;

    @Autowired
    private com.smboutique.api.service.CommandeClientService commandeClientService;

    @Autowired
    private com.smboutique.api.service.PdfService pdfService;

    @Autowired
    private com.smboutique.api.service.MouvementService mouvementService;

    @Autowired
    private com.smboutique.api.service.UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.repository.CaisseRepository caisseRepository;

    @Autowired
    private com.smboutique.api.service.CaisseService caisseService;

    @Autowired
    private com.smboutique.api.service.CaisseMovementService caisseMovementService;

    @Autowired
    private com.smboutique.api.service.CaisseTransactionService caisseTransactionService;

    @GetMapping
    public List<PaiementClient> getAllPaiementClients() {
        return paiementClientService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<PaiementClient> getPaiementClientById(@PathVariable Long id) {
        return paiementClientService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/pdf")
    public void getPaiementClientPdf(@PathVariable Long id, jakarta.servlet.http.HttpServletResponse response) {
        try {
            pdfService.writePaiementClientPdf(id, response);
            try {
                Long userId = null;
                try {
                    var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                    if (auth != null && auth.getName() != null) {
                        var u = utilisateurService.findByEmail(auth.getName()).orElse(null);
                        if (u != null) userId = u.getId();
                    }
                } catch (Exception ignore) {}
                var popt = paiementClientService.findById(id);
                if (popt.isPresent()) {
                    var p = popt.get();
                    Long boutiqueId = p.getCommandeClient() != null && p.getCommandeClient().getBoutique() != null ? p.getCommandeClient().getBoutique().getId() : null;
                    Double montant = p.getMontantPaye() != null ? Double.valueOf(p.getMontantPaye()) : null;
                    mouvementService.log("DOCUMENT", "PAIEMENT_CLIENT_PDF", "Génération PDF - PAIEMENT CLIENT", id, boutiqueId, null, userId, montant);
                }
            } catch (Exception ignore) {}
        } catch (Exception e) {
            try { response.sendError(500); } catch (Exception ignored) {}
        }
    }

    private boolean isSuperAdmin(com.smboutique.api.model.Utilisateur user) {
        if (user == null) return false;
        // Determine superadmin by role membership only
        return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
    }

    @PostMapping
    public ResponseEntity<PaiementClient> createPaiementClient(@RequestBody PaiementClient paiementClient) {
        org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(403).build();
        }
        com.smboutique.api.model.Utilisateur user = utilisateurService.findByEmail(authentication.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(403).build();
        if (!utilisateurService.hasPermission(user, "PAIEMENT_CREER") && !isSuperAdmin(user)) {
            // require explicit create permission (or superadmin)
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(paiementClientService.save(paiementClient));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PaiementClient> updatePaiementClient(@PathVariable Long id, @RequestBody PaiementClient paiementClientDetails) {
        org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(403).build();
        }
        com.smboutique.api.model.Utilisateur user = utilisateurService.findByEmail(authentication.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(403).build();
        if (!utilisateurService.hasPermission(user, "PAIEMENT_MODIFIER") && !isSuperAdmin(user)) {
            return ResponseEntity.status(403).build();
        }

        return paiementClientService.findById(id)
                .map(paiementClient -> {
                    paiementClient.setMontantPaye(paiementClientDetails.getMontantPaye());
                    paiementClient.setDatePaie(paiementClientDetails.getDatePaie());
                    paiementClient.setReference(paiementClientDetails.getReference());
                    paiementClient.setCommandeClient(paiementClientDetails.getCommandeClient());
                    paiementClient.setReferenceCaisse(paiementClientDetails.getReferenceCaisse());
                    return ResponseEntity.ok(paiementClientService.save(paiementClient));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePaiementClient(@PathVariable Long id) {
        org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(403).build();
        }
        com.smboutique.api.model.Utilisateur user = utilisateurService.findByEmail(authentication.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(403).build();
        if (!utilisateurService.hasPermission(user, "PAIEMENT_SUPPRESSION") && !isSuperAdmin(user)) {
            return ResponseEntity.status(403).build();
        }

        return paiementClientService.findById(id)
                .map(paiementClient -> {
                    paiementClientService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/cancel")
    @Transactional
    public ResponseEntity<Object> cancelPaiementClient(@PathVariable Long id, @RequestBody(required = false) java.util.Map<String, String> body) {
        org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(403).build();
        }
        com.smboutique.api.model.Utilisateur user = utilisateurService.findByEmail(authentication.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(403).build();
        if (!utilisateurService.hasPermission(user, "PAIEMENT_SUPPRESSION") && !utilisateurService.hasPermission(user, "PAIEMENT_ANNULATION") && !isSuperAdmin(user)) {
            return ResponseEntity.status(403).build();
        }

        java.util.Optional<PaiementClient> opt = paiementClientService.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        PaiementClient paiement = opt.get();
        if (paiement.getAnnule() != null && paiement.getAnnule()) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "Paiement déjà annulé"));
        }
        try {
            com.smboutique.api.model.CommandeClient cmd = paiement.getCommandeClient();
            if (cmd != null) {
                int currentPaie = cmd.getPaie() != null ? cmd.getPaie() : 0;
                int montant = paiement.getMontantPaye() != null ? paiement.getMontantPaye() : 0;
                cmd.setPaie(Math.max(0, currentPaie - montant));
                commandeClientService.save(cmd);

                // Note: we'll revert caisse total after marking paiement annulé (see below) using autowired repository/service.
            }

            paiement.setAnnule(true);
            paiement.setAnnuleAt(java.time.LocalDateTime.now());
            paiement.setAnnulePar(user.getId());
            paiement.setAnnuleReason(body != null ? body.getOrDefault("reason", null) : null);
            paiementClientService.save(paiement);

            // Try to revert caisse total for this paiement if applicable (use the referenceCaisse on the payout)
            try {
                String refC = paiement.getReferenceCaisse();
                Integer montant = paiement.getMontantPaye() != null ? paiement.getMontantPaye() : 0;
                if (refC != null && !refC.trim().isEmpty()) {
                    java.util.Optional<com.smboutique.api.model.Caisse> maybeC = caisseRepository.findByReference(refC);
                    java.util.Optional<com.smboutique.api.model.Caisse> locked = maybeC.flatMap(c -> c.getId() != null ? caisseRepository.findByIdForUpdate(c.getId()) : java.util.Optional.empty());
                    if (locked.isPresent()) {
                        com.smboutique.api.model.Caisse caisse = locked.get();
                        Integer cur = caisse.getMontantTotal() != null ? caisse.getMontantTotal() : 0;
                        Integer before = cur;
                        caisse.setMontantTotal(Math.max(0, cur - montant));
                        caisseService.save(caisse);

                        try {
                            com.smboutique.api.model.CaisseTransaction tx = new com.smboutique.api.model.CaisseTransaction();
                            tx.setType(com.smboutique.api.model.CaisseTransaction.TransactionType.REVERSAL);
                            tx.setMontant(montant);
                            tx.setPaiementId(paiement.getId());
                            tx.setCommandeId(paiement.getCommandeClient() != null ? paiement.getCommandeClient().getId() : null);
                            tx.setUserId(user.getId());
                            tx.setReferenceCaisse(refC);
                            tx.setBoutiqueId(paiement.getCommandeClient() != null && paiement.getCommandeClient().getBoutique() != null ? paiement.getCommandeClient().getBoutique().getId() : null);
                            tx.setRaison(body != null ? body.getOrDefault("reason", "Annulation paiement") : "Annulation paiement");
                            caisseTransactionService.save(tx);
                        } catch (Exception txEx) {
                            // ignore tx persistence errors
                        }

                        // Record a detailed movement for audit
                        try {
                            com.smboutique.api.model.CaisseMovement mv = new com.smboutique.api.model.CaisseMovement();
                            mv.setType(com.smboutique.api.model.CaisseMovement.MovementType.REVERSAL);
                            mv.setMontant(montant);
                            mv.setBalanceBefore(before);
                            mv.setBalanceAfter(caisse.getMontantTotal());
                            mv.setPaiementId(paiement.getId());
                            mv.setCommandeId(paiement.getCommandeClient() != null ? paiement.getCommandeClient().getId() : null);
                            mv.setUserId(user.getId());
                            mv.setReferenceCaisse(refC);
                            mv.setBoutiqueId(paiement.getCommandeClient() != null && paiement.getCommandeClient().getBoutique() != null ? paiement.getCommandeClient().getBoutique().getId() : null);
                            mv.setRaison(body != null ? body.getOrDefault("reason", "Annulation paiement") : "Annulation paiement");
                            caisseMovementService.save(mv);
                        } catch (Exception mvEx) {
                            // ignore movement errors
                        }
                    }
                }
            } catch (Exception exx) {
                // ignore caisse revert errors
            }

            return ResponseEntity.ok(java.util.Map.of("id", paiement.getId(), "annule", true));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(java.util.Map.of("error", "Internal server error"));
        }
    }
}
