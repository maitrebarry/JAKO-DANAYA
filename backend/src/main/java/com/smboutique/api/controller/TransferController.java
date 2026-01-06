package com.smboutique.api.controller;

import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.TransferService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/transferts")
public class TransferController {

    @Autowired
    private TransferService transferService;

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.service.TransferModuleService transferModuleService;

    @Autowired
    private com.smboutique.api.service.MouvementService mouvementService;

    @Autowired
    private com.smboutique.api.repository.StockRepository stockRepository;

    private Utilisateur getCurrentUser() {
        org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("Utilisateur authentifié introuvable");
        }
        return utilisateurService.findByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Utilisateur authentifié introuvable"));
    }

    private boolean hasPermission(Utilisateur user, String permissionName) {
        if (user == null) return false;
        return user.getPermissions().stream().anyMatch(p -> p.getName().equals(permissionName));
    }

    public static class TransferRequest {
        public Long sourceStockId;
        public Long destStockId;
        public Integer quantite;
    }

    @PostMapping
    public ResponseEntity<?> transfert(@RequestBody TransferRequest req) {
        try {
            Utilisateur user = getCurrentUser();
            if (!hasPermission(user, "TRANSFERT_CREER") && !hasPermission(user, "INVENTAIRE_MODIFIER")) {
                return ResponseEntity.status(403).body("Permission refusée pour effectuer un transfert");
            }

            transferService.transfer(req.sourceStockId, req.destStockId, req.quantite);
            try {
                String desc = "Transfert de stock entre emplacements";
                mouvementService.log("TRANSFERT", "STOCK", desc, null, user != null && user.getBoutique() != null ? user.getBoutique().getId() : null, null, user != null ? user.getId() : null, req.quantite != null ? Double.valueOf(req.quantite) : null);
            } catch (Exception l) {}
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (RuntimeException ex) {
            return ResponseEntity.status(500).body(ex.getMessage());
        }
    }

    // High level transfer between locations (boutique/magasin)
    public static class LocationTransferItem { public Long produitId; public Integer quantite; public Integer quantiteConditionnement; }
    public static class LocationTransferRequest { public String sourceType; public Long sourceId; public String destType; public Long destId; public java.util.List<LocationTransferItem> items; }

    @PostMapping("/locations")
    public ResponseEntity<?> transfertEntreEmplacements(@RequestBody LocationTransferRequest req) {
        try {
            Utilisateur user = getCurrentUser();
            if (!hasPermission(user, "TRANSFERT_CREER") && !hasPermission(user, "INVENTAIRE_MODIFIER")) {
                return ResponseEntity.status(403).body("Permission refusée pour effectuer un transfert");
            }
            if (req.items == null || req.items.isEmpty()) return ResponseEntity.badRequest().body(java.util.Map.of("error", "items requis"));
            java.util.List<com.smboutique.api.service.TransferModuleService.TransferItem> items = new java.util.ArrayList<>();
            for (TransferController.LocationTransferItem i : req.items) {
                int q = i.quantite != null ? i.quantite : 0;
                if (i.quantiteConditionnement != null) {
                    // lookup product multiplicateur
                    java.util.Optional<com.smboutique.api.model.Produit> prodOpt = java.util.Optional.empty();
                    // Try to find a stock that matches the produit to get multiplicateur; else try direct product repository if available
                    java.util.List<com.smboutique.api.model.Stock> stocks = stockRepository.findByProduitId(i.produitId);
                    if (stocks != null && !stocks.isEmpty() && stocks.get(0).getProduit() != null) prodOpt = java.util.Optional.of(stocks.get(0).getProduit());
                    int mul = 1;
                    if (prodOpt.isPresent() && prodOpt.get().getNombreUnitesParConditionnement() != null) mul = prodOpt.get().getNombreUnitesParConditionnement();
                    q = i.quantiteConditionnement * mul;
                }
                items.add(new com.smboutique.api.service.TransferModuleService.TransferItem(i.produitId, q));
            }
            String username = user.getEmail();
            transferModuleService.transferBetweenLocations(req.sourceType, req.sourceId, req.destType, req.destId, items, username);
            return ResponseEntity.ok(java.util.Map.of("success", true, "count", items.size()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(java.util.Map.of("error", "Erreur interne", "message", ex.getMessage()));
        }
    }
}
