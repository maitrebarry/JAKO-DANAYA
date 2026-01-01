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

    @GetMapping
    public ResponseEntity<List<CaisseTransaction>> findByReference(@RequestParam(required = false) String referenceCaisse) {
        if (referenceCaisse == null || referenceCaisse.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        List<CaisseTransaction> txs = caisseTransactionService.findByReferenceCaisse(referenceCaisse.trim());
        return ResponseEntity.ok(txs);
    }

    @GetMapping("/boutique/{boutiqueId}")
    public ResponseEntity<List<CaisseTransaction>> findByBoutique(@PathVariable Long boutiqueId) {
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
        return ResponseEntity.ok(txs);
    }
}
