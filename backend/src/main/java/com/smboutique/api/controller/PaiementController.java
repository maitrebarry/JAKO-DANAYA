package com.smboutique.api.controller;

import com.smboutique.api.model.Paiement;
import com.smboutique.api.model.CommandeFournisseur;
import com.smboutique.api.service.PaiementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/paiements")
@CrossOrigin(origins = "*")
public class PaiementController {

    @Autowired
    private PaiementService paiementService;

    @Autowired
    private com.smboutique.api.service.PdfService pdfService;

    @Autowired
    private com.smboutique.api.service.CommandeFournisseurService commandeFournisseurService;

    @Autowired
    private com.smboutique.api.service.UtilisateurService utilisateurService;

    @GetMapping
    public List<Paiement> getAllPaiements() {
        return paiementService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Paiement> getPaiementById(@PathVariable Long id) {
        return paiementService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/pdf")
    public void getPaiementPdf(@PathVariable Long id, jakarta.servlet.http.HttpServletResponse response) {
        try {
            pdfService.writePaiementPdf(id, response);
        } catch (Exception e) {
            try { response.sendError(500); } catch (Exception ignored) {}
        }
    }

    @PostMapping
    public Paiement createPaiement(@RequestBody Paiement paiement) {
        return paiementService.save(paiement);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Paiement> updatePaiement(@PathVariable Long id, @RequestBody Paiement paiementDetails) {
        return paiementService.findById(id)
                .map(paiement -> {
                    paiement.setMontantPaye(paiementDetails.getMontantPaye());
                    paiement.setDatePaie(paiementDetails.getDatePaie());
                    paiement.setReference(paiementDetails.getReference());
                    paiement.setCommandeFournisseur(paiementDetails.getCommandeFournisseur());
                    return ResponseEntity.ok(paiementService.save(paiement));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePaiement(@PathVariable Long id) {
        return paiementService.findById(id)
                .map(paiement -> {
                    paiementService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<Object> cancelPaiement(@PathVariable Long id, @RequestBody(required = false) java.util.Map<String, String> body) {
        // Basic permission check: require a user with 'PAIEMENT_SUPPRESSION' or 'PAIEMENT_ANNULATION'
        org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(403).build();
        }
        com.smboutique.api.model.Utilisateur user = utilisateurService.findByEmail(authentication.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(403).build();
        boolean hasPerm = user.getPermissions().stream().anyMatch(p -> p.getName().equals("PAIEMENT_SUPPRESSION") || p.getName().equals("PAIEMENT_ANNULATION"));
        if (!hasPerm) return ResponseEntity.status(403).build();

        java.util.Optional<Paiement> opt = paiementService.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        Paiement paiement = opt.get();
        if (paiement.getAnnule() != null && paiement.getAnnule()) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "Paiement déjà annulé"));
        }
        try {
            CommandeFournisseur cmd = paiement.getCommandeFournisseur();
            if (cmd != null) {
                int currentPaie = cmd.getPaie() != null ? cmd.getPaie() : 0;
                int montant = paiement.getMontantPaye() != null ? paiement.getMontantPaye() : 0;
                cmd.setPaie(Math.max(0, currentPaie - montant));
                commandeFournisseurService.save(cmd);
            }
            paiement.setAnnule(true);
            paiement.setAnnuleAt(java.time.LocalDateTime.now());
            paiement.setAnnulePar(user.getId());
            paiement.setAnnuleReason(body != null ? body.getOrDefault("reason", null) : null);
            paiementService.save(paiement);
            return ResponseEntity.ok(java.util.Map.of("id", paiement.getId(), "annule", true));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(java.util.Map.of("error", "Internal server error"));
        }
    }
}
