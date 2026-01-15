package com.smboutique.api.controller;

import com.smboutique.api.model.CaisseTransaction;
import com.smboutique.api.service.CaisseTransactionService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/caisse-transactions")
@CrossOrigin(origins = "*")
public class CaisseTransactionController {

    @Autowired
    private CaisseTransactionService caisseTransactionService;

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.repository.BoutiqueRepository boutiqueRepository;

    @GetMapping
    public ResponseEntity<?> findByReference(@RequestParam(required = false) String referenceCaisse) {
        if (referenceCaisse == null || referenceCaisse.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        List<CaisseTransaction> txs = caisseTransactionService.findByReferenceCaisse(referenceCaisse.trim());
        return ResponseEntity.ok(enrichTransactionsWithCurrency(txs));
    }

    @GetMapping("/boutique/{boutiqueId}")
    public ResponseEntity<?> findByBoutique(@PathVariable Long boutiqueId) {
        // allow only superadmin or same boutique users; basic check
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) return ResponseEntity.status(403).build();
        com.smboutique.api.model.Utilisateur user = utilisateurService.findByEmail(auth.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(403).build();
        boolean isSuper = user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
        if (!isSuper) {
            if (user.getBoutique() == null || !user.getBoutique().getId().equals(boutiqueId)) {
                return ResponseEntity.status(403).build();
            }
        }
        List<CaisseTransaction> txs = caisseTransactionService.findByBoutiqueId(boutiqueId);
        return ResponseEntity.ok(enrichTransactionsWithCurrency(txs));
    }

    private java.util.List<java.util.Map<String, Object>> enrichTransactionsWithCurrency(java.util.List<CaisseTransaction> transactions) {
        java.util.List<java.util.Map<String, Object>> enriched = new java.util.ArrayList<>();
        for (CaisseTransaction tx : transactions) {
            java.util.Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", tx.getId());
            map.put("type", tx.getType());
            map.put("montant", tx.getMontant());
            map.put("paiementId", tx.getPaiementId());
            map.put("commandeId", tx.getCommandeId());
            map.put("userId", tx.getUserId());
            map.put("referenceCaisse", tx.getReferenceCaisse());
            map.put("boutiqueId", tx.getBoutiqueId());
            map.put("raison", tx.getRaison());
            map.put("createdAt", tx.getCreatedAt());

            // Add currency symbol
            String deviseSymbole = "FCFA";
            try {
                if (tx.getBoutiqueId() != null) {
                    java.util.Optional<com.smboutique.api.model.Boutique> optB = boutiqueRepository.findById(tx.getBoutiqueId());
                    if (optB.isPresent()) {
                        com.smboutique.api.model.Boutique b = optB.get();
                        if (b.getPays() != null && b.getPays().getDeviseSymbole() != null) {
                            deviseSymbole = b.getPays().getDeviseSymbole();
                        }
                    }
                }
            } catch (Exception e) {
                // keep default
            }
            map.put("deviseSymbole", deviseSymbole);

            enriched.add(map);
        }
        return enriched;
    }
}
