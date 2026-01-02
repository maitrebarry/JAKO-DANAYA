package com.smboutique.api.controller;

import com.smboutique.api.model.Magasin;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.MagasinService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

@RestController
@RequestMapping("/api/magasins")
@CrossOrigin(origins = "*")
public class MagasinController {

    private static final Logger logger = LoggerFactory.getLogger(MagasinController.class);

    @Autowired
    private MagasinService magasinService;

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.service.ProduitService produitService;

    @Autowired
    private com.smboutique.api.service.StockService stockService;

    @Autowired
    private com.smboutique.api.service.TransferService transferService;

    private Utilisateur getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("Utilisateur authentifié introuvable");
        }
        return utilisateurService.findByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Utilisateur authentifié introuvable"));
    }

    private boolean isSuperAdmin(Utilisateur user) {
        if (user == null) return false;
        // Determine superadmin by role membership only
        return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
    }

    private boolean hasPermission(Utilisateur user, String permissionName) {
        if (user == null) return false;
        java.util.Set<com.smboutique.api.model.Permission> perms = user.getPermissions();
        if (perms == null) return false;
        return perms.stream().anyMatch(p -> permissionName.equals(p.getName()));
    }

    @GetMapping
    public List<Magasin> getAllMagasins() {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "INVENTAIRE_LECTURE")) {
            return List.of(); // Return empty list if no permission
        }
        if (isSuperAdmin(current)) {
            return magasinService.findAll();
        }
        if (current.getBoutique() == null) {
            return List.of();
        }
        return magasinService.findAllByBoutiqueId(current.getBoutique().getId());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Magasin> getMagasinById(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "INVENTAIRE_LECTURE")) {
            return ResponseEntity.status(403).build();
        }
        return magasinService.findById(id)
                .map(magasin -> {
                    if (!isSuperAdmin(current)) {
                        if (current.getBoutique() == null || magasin.getBoutique() == null || !current.getBoutique().getId().equals(magasin.getBoutique().getId())) {
                            return ResponseEntity.status(403).<Magasin>build();
                        }
                    }
                    return ResponseEntity.ok(magasin);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Magasin createMagasin(@RequestBody Magasin magasin) {
        Utilisateur current = getCurrentUser();
        // allow SUPERADMIN users (by role or type) to bypass explicit permission checks
        if (!isSuperAdmin(current) && !hasPermission(current, "INVENTAIRE_CREER")) {
            throw new RuntimeException("Permission manquante : INVENTAIRE_CREER");
        }
        if (!isSuperAdmin(current)) {
            magasin.setBoutique(current.getBoutique());
        }
        return magasinService.save(magasin);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Magasin> updateMagasin(@PathVariable Long id, @RequestBody Magasin magasinDetails) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "INVENTAIRE_MODIFIER")) {
            return ResponseEntity.status(403).build();
        }
        return magasinService.findById(id)
                .map(magasin -> {
                    if (!isSuperAdmin(current)) {
                        if (current.getBoutique() == null || magasin.getBoutique() == null || !current.getBoutique().getId().equals(magasin.getBoutique().getId())) {
                            return ResponseEntity.status(403).<Magasin>build();
                        }
                        magasin.setBoutique(current.getBoutique());
                    } else {
                        magasin.setBoutique(magasinDetails.getBoutique());
                    }
                    magasin.setNom(magasinDetails.getNom());
                    magasin.setAdresse(magasinDetails.getAdresse());
                    magasin.setTypeMagasin(magasinDetails.getTypeMagasin());
                    return ResponseEntity.ok(magasinService.save(magasin));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMagasin(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "INVENTAIRE_SUPPRIMER")) {
            return ResponseEntity.status(403).build();
        }
        return magasinService.findById(id)
                .map(magasin -> {
                    if (!isSuperAdmin(current)) {
                        if (current.getBoutique() == null || magasin.getBoutique() == null || !current.getBoutique().getId().equals(magasin.getBoutique().getId())) {
                            return ResponseEntity.status(403).<Void>build();
                        }
                    }
                    magasinService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Assign a list of products to a magasin by creating magasin-level Stock entries (quantiteDisponible=0)
     * Request body: { "productIds": [1,2,3] }
     */
    @PostMapping("/{id}/assign-products")
    public ResponseEntity<?> assignProductsToMagasin(@PathVariable Long id, @RequestBody java.util.Map<String, java.util.List<Long>> body) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "INVENTAIRE_MODIFIER") && !isSuperAdmin(current)) {
            return ResponseEntity.status(403).body("Permission manquante : INVENTAIRE_MODIFIER");
        }
        java.util.List<Long> productIds = body.getOrDefault("productIds", java.util.Collections.emptyList());
        return magasinService.findById(id)
                .map(magasin -> {
                    if (!isSuperAdmin(current)) {
                        if (current.getBoutique() == null || magasin.getBoutique() == null || !current.getBoutique().getId().equals(magasin.getBoutique().getId())) {
                            return ResponseEntity.status(403).<Object>build();
                        }
                    }
                    java.util.List<Long> created = new java.util.ArrayList<>();
                    for (Long pid : productIds) {
                        if (pid == null) continue;
                        com.smboutique.api.model.Produit p = produitService.findById(pid).orElse(null);
                        if (p == null) continue;
                        java.util.Optional<com.smboutique.api.model.Stock> existing = stockService.getStockByProduitAndMagasin(pid, id);
                        if (existing.isPresent()) {
                            logger.info("Assign-products: product {} already has a magasin-level stock for magasin {} -> skipping", pid, id);
                            continue;
                        }

                        // If there's an existing boutique-level stock (magasin == null), we must NOT modify it - create a new magasin stock instead
                        java.util.List<com.smboutique.api.model.Stock> boutiqueStocks = stockService.getStocksByProduitAndBoutique(pid, magasin.getBoutique().getId());
                        com.smboutique.api.model.Stock boutiqueLevelStock = null;
                        if (boutiqueStocks != null) {
                            for (com.smboutique.api.model.Stock bs : boutiqueStocks) {
                                if (bs.getMagasin() == null) {
                                    boutiqueLevelStock = bs;
                                    break;
                                }
                            }
                        }

                        if (boutiqueLevelStock != null) {
                            logger.info("Assign-products: boutique-level stock found (id={}) for product {} in boutique {}. Creating NEW magasin-level stock (magasin={}) with quantiteDisponible=0. NOT modifying boutique stock.", boutiqueLevelStock.getId(), pid, magasin.getBoutique().getId(), magasin.getId());
                            com.smboutique.api.model.Stock s = new com.smboutique.api.model.Stock();
                            s.setProduit(p);
                            s.setMagasin(magasin);
                            s.setBoutique(magasin.getBoutique());
                            s.setQuantiteDisponible(0);
                            stockService.saveStock(s);
                            created.add(pid);
                            continue;
                        }

                        logger.info("Assign-products: no boutique-level stock found for product {} in boutique {}. Creating magasin-level stock for magasin {}.", pid, magasin.getBoutique().getId(), magasin.getId());
                        com.smboutique.api.model.Stock s = new com.smboutique.api.model.Stock();
                        s.setProduit(p);
                        s.setMagasin(magasin);
                        s.setBoutique(magasin.getBoutique());
                        s.setQuantiteDisponible(0);
                        stockService.saveStock(s);
                        created.add(pid);
                    }
                    java.util.Map<String, Object> resp = new java.util.HashMap<>();
                    resp.put("createdProductIds", created);
                    resp.put("count", created.size());
                    return ResponseEntity.ok(resp);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Transfer a quantity from a magasin's stock (produit) to its boutique-level stock.
     * Request body: { "produitId": 10, "quantite": 5 }
     */
    @PostMapping("/{id}/transfer-to-boutique")
    public ResponseEntity<?> transferFromMagasinToBoutique(@PathVariable Long id, @RequestBody java.util.Map<String, Object> body) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "INVENTAIRE_MODIFIER") && !isSuperAdmin(current)) {
            return ResponseEntity.status(403).body("Permission manquante : INVENTAIRE_MODIFIER");
        }
        Long produitId = body.get("produitId") == null ? null : Long.valueOf(body.get("produitId").toString());
        Integer quantite = body.get("quantite") == null ? null : Integer.valueOf(body.get("quantite").toString());
        if (produitId == null || quantite == null) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "produitId et quantite sont requis"));
        }

        return magasinService.findById(id)
                .map(magasin -> {
                    if (!isSuperAdmin(current)) {
                        if (current.getBoutique() == null || magasin.getBoutique() == null || !current.getBoutique().getId().equals(magasin.getBoutique().getId())) {
                            return ResponseEntity.status(403).<Object>build();
                        }
                    }

                    // find source stock (magasin-level)
                    java.util.Optional<com.smboutique.api.model.Stock> sourceOpt = stockService.getStockByProduitAndMagasin(produitId, id);
                    if (sourceOpt.isEmpty()) {
                        return ResponseEntity.status(404).body(java.util.Map.of("error", "Stock en magasin introuvable pour ce produit"));
                    }
                    com.smboutique.api.model.Stock source = sourceOpt.get();

                    // find boutique-level stock (magasin == null) for same boutique
                    java.util.List<com.smboutique.api.model.Stock> boutiqueStocks = stockService.getStocksByProduitAndBoutique(produitId, magasin.getBoutique().getId());
                    com.smboutique.api.model.Stock dest = null;
                    if (boutiqueStocks != null) {
                        for (com.smboutique.api.model.Stock bs : boutiqueStocks) {
                            if (bs.getMagasin() == null) { dest = bs; break; }
                        }
                    }
                    if (dest == null) {
                        return ResponseEntity.status(409).body(java.util.Map.of("error", "Stock boutique introuvable pour ce produit. Assignez d'abord le produit à la boutique."));
                    }

                    try {
                        // delegate to TransferService (transactional)
                        transferService.transfer(source.getId(), dest.getId(), quantite);
                        // reload stocks to report quantities
                        java.util.Optional<com.smboutique.api.model.Stock> s2 = stockService.getStockByProduitAndMagasin(produitId, id);
                        java.util.List<com.smboutique.api.model.Stock> bs2 = stockService.getStocksByProduitAndBoutique(produitId, magasin.getBoutique().getId());
                        Integer magQty = s2.map(st -> st.getQuantiteDisponible() == null ? 0 : st.getQuantiteDisponible()).orElse(0);
                        Integer boutQty = 0;
                        if (bs2 != null) {
                            for (com.smboutique.api.model.Stock bs : bs2) {
                                if (bs.getMagasin() == null) { boutQty = bs.getQuantiteDisponible() == null ? 0 : bs.getQuantiteDisponible(); break; }
                            }
                        }
                        return ResponseEntity.ok(java.util.Map.of("success", true, "quantiteTransferee", quantite, "stockMagasin", magQty, "stockBoutique", boutQty));
                    } catch (IllegalArgumentException ex) {
                        return ResponseEntity.badRequest().body(java.util.Map.of("error", ex.getMessage()));
                    } catch (Exception ex) {
                        return ResponseEntity.status(500).body(java.util.Map.of("error", "Erreur interne lors du transfert", "message", ex.getMessage()));
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/stocks")
    public ResponseEntity<?> getStocksForMagasin(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "INVENTAIRE_LECTURE") && !isSuperAdmin(current)) {
            return ResponseEntity.status(403).body("Permission manquante : INVENTAIRE_LECTURE");
        }
        return magasinService.findById(id)
                .map(magasin -> {
                    if (!isSuperAdmin(current)) {
                        if (current.getBoutique() == null || magasin.getBoutique() == null || !current.getBoutique().getId().equals(magasin.getBoutique().getId())) {
                            return ResponseEntity.status(403).<Object>build();
                        }
                    }
                    java.util.List<com.smboutique.api.model.Stock> stocks = stockService.getStocksByMagasin(id);
                    java.util.List<Object> resp = new java.util.ArrayList<>();
                    for (com.smboutique.api.model.Stock s : stocks) {
                        java.util.Map<String, Object> m = new java.util.HashMap<>();
                        m.put("id", s.getId());
                        m.put("produitId", s.getProduit() != null ? s.getProduit().getId() : null);
                        m.put("nomProduit", s.getProduit() != null ? s.getProduit().getNomProduit() : null);
                        m.put("quantiteDisponible", s.getQuantiteDisponible() == null ? 0 : s.getQuantiteDisponible());
                        m.put("unite", s.getProduit() != null && s.getProduit().getUnite() != null ? s.getProduit().getUnite().getLibelle() : null);
                        resp.add(m);
                    }
                    return ResponseEntity.ok(resp);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}