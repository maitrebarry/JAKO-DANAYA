package com.smboutique.api.controller;

import com.smboutique.api.model.PaiementClient;
import com.smboutique.api.service.PaiementClientService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
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
    private com.smboutique.api.service.UtilisateurService utilisateurService;

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
        } catch (Exception e) {
            try { response.sendError(500); } catch (Exception ignored) {}
        }
    }

    @PostMapping
    public PaiementClient createPaiementClient(@RequestBody PaiementClient paiementClient) {
        return paiementClientService.save(paiementClient);
    }

    @PutMapping("/{id}")
    public ResponseEntity<PaiementClient> updatePaiementClient(@PathVariable Long id, @RequestBody PaiementClient paiementClientDetails) {
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
        return paiementClientService.findById(id)
                .map(paiementClient -> {
                    paiementClientService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<Object> cancelPaiementClient(@PathVariable Long id, @RequestBody(required = false) java.util.Map<String, String> body) {
        org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(403).build();
        }
        com.smboutique.api.model.Utilisateur user = utilisateurService.findByEmail(authentication.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(403).build();
        boolean hasPerm = user.getPermissions().stream().anyMatch(p -> p.getName().equals("PAIEMENT_SUPPRESSION") || p.getName().equals("PAIEMENT_ANNULATION"));
        if (!hasPerm) return ResponseEntity.status(403).build();

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
            }
            paiement.setAnnule(true);
            paiement.setAnnuleAt(java.time.LocalDateTime.now());
            paiement.setAnnulePar(user.getId());
            paiement.setAnnuleReason(body != null ? body.getOrDefault("reason", null) : null);
            paiementClientService.save(paiement);
            return ResponseEntity.ok(java.util.Map.of("id", paiement.getId(), "annule", true));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(java.util.Map.of("error", "Internal server error"));
        }
    }
}
