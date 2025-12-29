package com.smboutique.api.controller;

import com.smboutique.api.model.*;
import com.smboutique.api.service.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@RestController
@CrossOrigin(origins = "*")
public class CommandeClientLivraisonController {

    @Autowired
    private com.smboutique.api.service.CommandeClientService commandeClientService;

    @Autowired
    private com.smboutique.api.service.LigneCommandeClientService ligneCommandeClientService;

    @Autowired
    private StockService stockService;

    @Autowired
    private LivraisonService livraisonService;

    @Autowired
    private LigneLivraisonService ligneLivraisonService;

    @Autowired
    private MouvementService mouvementService;

    @Autowired
    private UtilisateurService utilisateurService;

    private com.smboutique.api.model.Utilisateur getCurrentUser() {
        org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("Utilisateur authentifié introuvable");
        }
        return utilisateurService.findByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Utilisateur authentifié introuvable"));
    }

    private boolean isSuperAdmin(Utilisateur user) {
        if (user == null) return false;
        boolean hasRole = user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
        boolean hasType = "SUPERADMIN".equalsIgnoreCase(user.getTypeUtilisateur());
        return hasRole || hasType;
    }

    private boolean hasPermission(Utilisateur user, String permissionName) {
        if (user == null) return false;
        return user.getPermissions().stream().anyMatch(p -> p.getName().equals(permissionName));
    }

    public static class LivraisonLineRequest {
        public Long ligneCommandeId;
        public Long stockId;
        public Integer quantite;
    }

    public static class CommandeClientLivraisonRequest {
        public String reference;
        public List<LivraisonLineRequest> lignes = new ArrayList<>();
    }

    @PostMapping("/api/commandes-clients/{commandeId}/livraisons")
    @Transactional
    public ResponseEntity<?> deliverCommandeClient(@PathVariable Long commandeId, @RequestBody CommandeClientLivraisonRequest request) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "LIVRAISON_ECRITURE") && !isSuperAdmin(user)) {
            return ResponseEntity.status(403).build();
        }

        Optional<CommandeClient> ccOpt = commandeClientService.findById(commandeId);
        if (!ccOpt.isPresent()) return ResponseEntity.notFound().build();
        CommandeClient cc = ccOpt.get();

        try {
            // Validate
            for (LivraisonLineRequest lr : request.lignes) {
                if (lr.quantite == null || lr.quantite <= 0) continue;
                LigneCommandeClient lcc = ligneCommandeClientService.findById(lr.ligneCommandeId).orElseThrow(() -> new RuntimeException("LigneCommandeClient introuvable"));
                if (lcc.getCommandeClient() == null || !lcc.getCommandeClient().getId().equals(commandeId)) throw new RuntimeException("LigneCommandeClient ne correspond pas à la commande");
                Stock stock = stockService.getStockById(lr.stockId).orElseThrow(() -> new RuntimeException("Stock introuvable"));
                Integer available = stock.getQuantiteDisponible() != null ? stock.getQuantiteDisponible() : 0;
                if (available < lr.quantite) throw new RuntimeException("Stock insuffisant pour le produit " + (lcc.getProduit() != null ? lcc.getProduit().getId() : ""));
            }

            // Create Livraison
            Livraison liv = new Livraison();
            liv.setDateLivraison(LocalDateTime.now());
            liv.setReference(request.reference != null ? request.reference : "LC-" + System.currentTimeMillis());
            liv.setCommandeClient(cc);
            Livraison savedLiv = livraisonService.save(liv);

            for (LivraisonLineRequest lr : request.lignes) {
                if (lr.quantite == null || lr.quantite <= 0) continue;
                LigneCommandeClient lcc = ligneCommandeClientService.findById(lr.ligneCommandeId).orElseThrow(() -> new RuntimeException("LigneCommandeClient introuvable"));
                Stock stock = stockService.getStockById(lr.stockId).orElseThrow(() -> new RuntimeException("Stock introuvable"));

                // decrement stock
                Integer available = stock.getQuantiteDisponible() != null ? stock.getQuantiteDisponible() : 0;
                stock.setQuantiteDisponible(available - lr.quantite);
                stockService.saveStock(stock);

                // create ligne livraison
                com.smboutique.api.model.LigneLivraison ligneLivraison = new com.smboutique.api.model.LigneLivraison();
                ligneLivraison.setLivraison(savedLiv);
                ligneLivraison.setQuantiteRecu(lr.quantite);
                ligneLivraison.setProduit(lcc.getProduit());
                ligneLivraisonService.save(ligneLivraison);

                // update qte_livre on ligne commande client
                Integer qteLivreActuelle = lcc.getQuantiteLivre() != null ? lcc.getQuantiteLivre() : 0;
                lcc.setQuantiteLivre(qteLivreActuelle + lr.quantite);
                ligneCommandeClientService.save(lcc);

                // create mouvement (SORTIE)
                Mouvement mv = new Mouvement();
                mv.setProduit(lcc.getProduit());
                mv.setQuantite(lr.quantite);
                mv.setTypeMouvement("SORTIE");
                mv.setDateMouvement(LocalDateTime.now());
                mv.setStock(stock);
                mv.setBoutique(user.getBoutique());
                mv.setLigneLivraison(ligneLivraison);
                mouvementService.save(mv);
            }

            return ResponseEntity.ok(savedLiv);
        } catch (Exception e) {
            org.springframework.transaction.interceptor.TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
            return ResponseEntity.status(500).body(e.getMessage());
        }
    }
}
