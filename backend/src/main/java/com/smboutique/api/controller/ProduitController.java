package com.smboutique.api.controller;

import com.smboutique.api.model.Magasin;
import com.smboutique.api.model.Produit;
import com.smboutique.api.model.Stock;
import com.smboutique.api.model.Unite;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.ProduitService;
import com.smboutique.api.repository.MagasinRepository;
import com.smboutique.api.service.StockService;
import com.smboutique.api.service.UniteService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/produits")
@CrossOrigin(origins = "*")
public class ProduitController {

    private static final String UPLOAD_DIR = "uploads/products/";
    @Autowired
    private ProduitService produitService;

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private UniteService uniteService;

    @Autowired
    private StockService stockService;

    @Autowired
    private MagasinRepository magasinRepository;

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
        boolean hasRole = user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
        boolean hasType = "SUPERADMIN".equalsIgnoreCase(user.getTypeUtilisateur());
        return hasRole || hasType;
    }

    private boolean hasPermission(Utilisateur user, String permissionName) {
        if (user == null) return false;
        return user.getPermissions().stream().anyMatch(p -> p.getName().equals(permissionName));
    }

    @GetMapping
    public List<Produit> getAllProduits() {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "PRODUIT_LECTURE")) {
            return List.of(); // Return empty list if no permission
        }
        if (isSuperAdmin(user)) {
            return produitService.findAll();
        } else {
            return produitService.findByBoutiqueId(user.getBoutique().getId());
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Produit> getProduitById(@PathVariable Long id) {
        Optional<Produit> produitOpt = produitService.findById(id);
        return produitOpt
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
                    

    @PostMapping
    public ResponseEntity<?> createProduit(@RequestParam("nomProduit") String nomProduit,
                                 @RequestParam("productImage") String productImage,
                                 @RequestParam(value = "imageFile", required = false) MultipartFile imageFile,
                                 @RequestParam("prixEnGros") String prixEnGros,
                                 @RequestParam("prixDetail") String prixDetail,
                                 @RequestParam("prixAchat") String prixAchat,
                                 @RequestParam("alerteStock") String alerteStock,
                                 @RequestParam("uniteId") String uniteId,
                                 @RequestParam(value = "magasinIds", required = false) List<Long> magasinIds) throws IOException {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "PRODUIT_CREER")) {
            return ResponseEntity.status(403).body("Permission manquante : PRODUIT_CREER");
        }
        Produit produit = new Produit();
        produit.setNomProduit(nomProduit);

        // Handle image
        if (imageFile != null && !imageFile.isEmpty()) {
            String fileName = UUID.randomUUID().toString() + "_" + imageFile.getOriginalFilename();
            Path uploadPath = Paths.get(UPLOAD_DIR);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
            Files.write(uploadPath.resolve(fileName), imageFile.getBytes());
            produit.setProductImage(fileName);
        } else if (productImage != null && !productImage.trim().isEmpty()) {
            produit.setProductImage(productImage);
        }

        produit.setPrixEnGros(prixEnGros.isEmpty() ? null : Integer.valueOf(prixEnGros));
        produit.setPrixDetail(prixDetail.isEmpty() ? null : Integer.valueOf(prixDetail));
        produit.setPrixAchat(prixAchat.isEmpty() ? null : Integer.valueOf(prixAchat));
        produit.setAlerteStock(alerteStock.isEmpty() ? null : Integer.valueOf(alerteStock));

        if (uniteId != null && !uniteId.isEmpty()) {
            Unite unite = uniteService.findById(Long.parseLong(uniteId))
                    .orElseThrow(() -> new IllegalArgumentException("Unité non trouvée"));
            produit.setUnite(unite);
        }

        // Validate price constraints: prixAchat < prixEnGros < prixDetail
        Integer pa = produit.getPrixAchat();
        Integer peg = produit.getPrixEnGros();
        Integer pd = produit.getPrixDetail();
        if (pa != null && peg != null && pa >= peg) {
            java.util.Map<String, Object> err = new java.util.HashMap<>();
            err.put("error", "Le prix d'achat doit être inférieur au prix en gros.");
            return ResponseEntity.badRequest().body(err);
        }
        if (peg != null && pd != null && peg >= pd) {
            java.util.Map<String, Object> err = new java.util.HashMap<>();
            err.put("error", "Le prix en gros doit être inférieur au prix détail.");
            return ResponseEntity.badRequest().body(err);
        }

        Produit savedProduit = produitService.save(produit);

        // Créer les stocks pour les magasins sélectionnés ou pour tous les magasins de la boutique si non précisé
        if (magasinIds != null && !magasinIds.isEmpty()) {
            for (Long magasinId : magasinIds) {
                Stock stock = new Stock();
                stock.setProduit(savedProduit);
                Magasin magasin = magasinRepository.findById(magasinId)
                        .orElseThrow(() -> new IllegalArgumentException("Magasin non trouvé"));
                stock.setMagasin(magasin);
                stock.setQuantiteDisponible(0);
                stockService.saveStock(stock);
            }
        }
        else {
            // No magasin specified -> create stock entries for all boutique magasins
            Utilisateur currentUser = getCurrentUser();
            if (currentUser != null && currentUser.getBoutique() != null) {
                Long boutiqueId = currentUser.getBoutique().getId();
                List<Magasin> magasins = magasinRepository.findByBoutiqueId(boutiqueId);
                for (Magasin mg : magasins) {
                    Stock stock = new Stock();
                    stock.setProduit(savedProduit);
                    stock.setMagasin(mg);
                    stock.setQuantiteDisponible(0);
                    stockService.saveStock(stock);
                }
            }
        }

        return ResponseEntity.ok(savedProduit);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateProduit(@PathVariable Long id,
                                                 @RequestParam("nomProduit") String nomProduit,
                                                 @RequestParam("productImage") String productImage,
                                                 @RequestParam(value = "imageFile", required = false) MultipartFile imageFile,
                                                 @RequestParam("prixEnGros") String prixEnGros,
                                                 @RequestParam("prixDetail") String prixDetail,
                                                 @RequestParam("prixAchat") String prixAchat,
                                                 @RequestParam("alerteStock") String alerteStock,
                                                 @RequestParam("uniteId") String uniteId,
                                                 @RequestParam(value = "magasinIds", required = false) List<Long> magasinIds) throws IOException {
        Optional<Produit> produitOpt = produitService.findById(id);

        return produitOpt
                .map(produit -> {
                    produit.setNomProduit(nomProduit);

                    // Handle image
                    if (imageFile != null && !imageFile.isEmpty()) {
                        try {
                            String fileName = UUID.randomUUID().toString() + "_" + imageFile.getOriginalFilename();
                            Path uploadPath = Paths.get(UPLOAD_DIR);
                            if (!Files.exists(uploadPath)) {
                                Files.createDirectories(uploadPath);
                            }
                            Files.write(uploadPath.resolve(fileName), imageFile.getBytes());
                            produit.setProductImage(fileName);
                        } catch (IOException e) {
                            throw new RuntimeException(e);
                        }
                    } else if (productImage != null && !productImage.trim().isEmpty()) {
                        produit.setProductImage(productImage);
                    }
                    

                    produit.setPrixEnGros(prixEnGros.isEmpty() ? null : Integer.valueOf(prixEnGros));
                    produit.setPrixDetail(prixDetail.isEmpty() ? null : Integer.valueOf(prixDetail));
                    produit.setPrixAchat(prixAchat.isEmpty() ? null : Integer.valueOf(prixAchat));

                    // Validate price constraints: prixAchat < prixEnGros < prixDetail
                    Integer pa = produit.getPrixAchat();
                    Integer peg = produit.getPrixEnGros();
                    Integer pd = produit.getPrixDetail();
                    if (pa != null && peg != null && pa >= peg) {
                        java.util.Map<String, Object> err = new java.util.HashMap<>();
                        err.put("error", "Le prix d'achat doit être inférieur au prix en gros.");
                        return ResponseEntity.badRequest().body(err);
                    }
                    if (peg != null && pd != null && peg >= pd) {
                        java.util.Map<String, Object> err = new java.util.HashMap<>();
                        err.put("error", "Le prix en gros doit être inférieur au prix détail.");
                        return ResponseEntity.badRequest().body(err);
                    }
                    produit.setAlerteStock(alerteStock.isEmpty() ? null : Integer.valueOf(alerteStock));

                    if (uniteId != null && !uniteId.isEmpty()) {
                        Unite unite = uniteService.findById(Long.parseLong(uniteId))
                                .orElseThrow(() -> new IllegalArgumentException("Unité non trouvée"));
                        produit.setUnite(unite);
                    }

                    Produit saved = produitService.save(produit);
                    if (magasinIds != null) {
                        for (Long mgid : magasinIds) {
                            if (mgid == null) continue;
                            Optional<Stock> existingStock = stockService.getStockByProduitAndMagasin(saved.getId(), mgid);
                            if (!existingStock.isPresent()) {
                                Optional<Magasin> magasinOpt = magasinRepository.findById(mgid);
                                if (magasinOpt.isPresent()) {
                                    Stock s = new Stock();
                                    s.setProduit(saved);
                                    s.setMagasin(magasinOpt.get());
                                    s.setQuantiteDisponible(0);
                                    stockService.saveStock(s);
                                }
                            }
                        }
                        List<Stock> existingStocks = stockService.getStocksByProduit(saved.getId());
                        for (Stock st : existingStocks) {
                            if (st.getMagasin() != null && !magasinIds.contains(st.getMagasin().getId())) {
                                stockService.deleteStock(st.getId());
                            }
                        }
                    }

                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProduit(@PathVariable Long id) {
        Optional<Produit> produitOpt = produitService.findById(id);

        return produitOpt
                .map(produit -> {
                    produitService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // The template endpoint was removed: the static template is now served by the front-end from `front-react/public/produits_template.xlsx`.

    @PostMapping("/import")
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE')")
    public ResponseEntity<?> importFromExcel(@RequestParam("file") MultipartFile file) {
        Utilisateur current = getCurrentUser();
        try {
            com.smboutique.api.dto.ImportResult result = produitService.importFromExcel(file, current);
            return ResponseEntity.ok(result);
        } catch (com.smboutique.api.exception.ImportValidationException ve) {
            java.util.Map<String, Object> err = new java.util.HashMap<>();
            err.put("error", "Validation failed");
            err.put("errors", ve.getErrors());
            return ResponseEntity.badRequest().body(err);
        } catch (Exception e) {
            java.util.Map<String, Object> err = new java.util.HashMap<>();
            err.put("error", "Import failed");
            err.put("details", e.getMessage());
            return ResponseEntity.internalServerError().body(err);
        }
    }
}





