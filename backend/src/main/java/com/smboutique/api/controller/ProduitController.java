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
import com.smboutique.api.dto.ProduitCreateDTO;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

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
    private com.smboutique.api.service.ConfigurationMargeService configurationMargeService;

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
        // Only check role membership for SUPERADMIN; avoid relying on typeUtilisateur
        return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
    }

    private boolean hasPermission(Utilisateur user, String permissionName) {
        // Use central utilisateurService to check both direct and role-derived permissions
        return utilisateurService.hasPermission(user, permissionName);
    }

    @GetMapping
    public List<Produit> getAllProduits() {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "PRODUIT_LECTURE")) {
            return List.of(); // Return empty list if no permission
        }
        List<Produit> produits;
        if (isSuperAdmin(user)) {
            produits = produitService.findAll();
        } else {
            produits = produitService.findByBoutiqueId(user.getBoutique().getId());
        }
        // Convert image paths to full URLs
        for (Produit produit : produits) {
            enrichProduitResponse(produit);
        }
        return produits;
    }

    @GetMapping("/{id}")
    public ResponseEntity<Produit> getProduitById(@PathVariable Long id) {
        Optional<Produit> produitOpt = produitService.findById(id);
        if (produitOpt.isPresent()) {
            Produit produit = produitOpt.get();
            enrichProduitResponse(produit);
            return ResponseEntity.ok(produit);
        }
        return ResponseEntity.notFound().build();
    }
                    

    @PostMapping
    public ResponseEntity<?> createProduit(@RequestParam("nomProduit") String nomProduit,
                                 @RequestParam("productImage") String productImage,
                                 @RequestParam(value = "imageFile", required = false) MultipartFile imageFile,
                                 @RequestParam("prixEnGros") String prixEnGros,
                                 @RequestParam("prixDetail") String prixDetail,
                                 @RequestParam("prixAchat") String prixAchat,
                                 @RequestParam("alerteStock") String alerteStock,
                                 @RequestParam(value = "uniteConditionnementId", required = false) Long uniteConditionnementId,
                                 @RequestParam(value = "nombreUnitesParConditionnement", required = false) String nombreUnitesParConditionnement,
                                 @RequestParam("quantiteInitiale") String quantiteInitiale,
                                 @RequestParam(value = "magasinIds", required = false) List<Long> magasinIds) throws IOException {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "PRODUIT_CREER") && !isSuperAdmin(current)) {
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

        // If the front did not compute the prices, try to compute them on the server using the boutique's margin configuration
        try {
            if (produit.getPrixAchat() != null && (produit.getPrixEnGros() == null || produit.getPrixDetail() == null)) {
                Long boutiqueId = current.getBoutique() != null ? current.getBoutique().getId() : null;
                org.slf4j.LoggerFactory.getLogger(ProduitController.class).info("Attempt margin compute: user={}, boutiqueId={}, prixAchat={}, prixEnGros={}, prixDetail={}", current.getEmail(), boutiqueId, produit.getPrixAchat(), produit.getPrixEnGros(), produit.getPrixDetail());
                if (boutiqueId == null) {
                    org.slf4j.LoggerFactory.getLogger(ProduitController.class).info("No boutique for user {} - skipping margin compute", current.getEmail());
                }
                if (boutiqueId != null) {
                    com.smboutique.api.model.ConfigurationMarge cfg = configurationMargeService.findByBoutiqueId(boutiqueId).orElse(null);
                    if (cfg == null) {
                        org.slf4j.LoggerFactory.getLogger(ProduitController.class).info("No configuration marge found for boutique {}", boutiqueId);
                    }
                    if (cfg != null) {
                        int prixAchatVal = produit.getPrixAchat();
                        int prixGrosComputed = prixAchatVal;
                        int prixDetailComputed = prixAchatVal;

                        if (cfg.getTypeMarge() == com.smboutique.api.model.ConfigurationMarge.TypeMarge.FIXE) {
                            double vG = cfg.getValeurGros() != null ? cfg.getValeurGros().doubleValue() : 0.0;
                            double vD = cfg.getValeurDetail() != null ? cfg.getValeurDetail().doubleValue() : 0.0;
                            double minG = cfg.getMargeMinimaleGros() != null ? cfg.getMargeMinimaleGros().doubleValue() : 0.0;
                            double minD = cfg.getMargeMinimaleDetail() != null ? cfg.getMargeMinimaleDetail().doubleValue() : 0.0;
                            double margG = Math.max(vG, minG);
                            double margD = Math.max(vD, minD);
                            prixGrosComputed = (int)Math.round(prixAchatVal + margG);
                            prixDetailComputed = (int)Math.round(prixAchatVal + margD);
                        } else {
                            double vgPct = cfg.getValeurGros() != null ? cfg.getValeurGros().doubleValue() : 0.0;
                            double vdPct = cfg.getValeurDetail() != null ? cfg.getValeurDetail().doubleValue() : 0.0;
                            double compG = Math.round(prixAchatVal * vgPct / 100.0);
                            double compD = Math.round(prixAchatVal * vdPct / 100.0);
                            double minG = cfg.getMargeMinimaleGros() != null ? cfg.getMargeMinimaleGros().doubleValue() : 0.0;
                            double minD = cfg.getMargeMinimaleDetail() != null ? cfg.getMargeMinimaleDetail().doubleValue() : 0.0;
                            double margG = Math.max(compG, minG);
                            double margD = Math.max(compD, minD);
                            prixGrosComputed = (int)Math.round(prixAchatVal + margG);
                            prixDetailComputed = (int)Math.round(prixAchatVal + margD);
                        }

                        org.slf4j.LoggerFactory.getLogger(ProduitController.class).warn("Computed marges for boutique {}: gros={}, detail={}, margG={}, margD={}", boutiqueId, prixGrosComputed, prixDetailComputed, prixGrosComputed - prixAchatVal, prixDetailComputed - prixAchatVal);
                        if (produit.getPrixEnGros() == null) produit.setPrixEnGros(prixGrosComputed);
                        if (produit.getPrixDetail() == null) produit.setPrixDetail(prixDetailComputed);
                        // also record applied margins
                        produit.setMargeGros(java.math.BigDecimal.valueOf(Math.max(prixGrosComputed - prixAchatVal, 0)));
                        produit.setMargeDetail(java.math.BigDecimal.valueOf(Math.max(prixDetailComputed - prixAchatVal, 0)));
                    }
                }
            }
        } catch (Exception e) {
            // Do not block product creation for margin computation errors – log for investigation
            org.slf4j.LoggerFactory.getLogger(ProduitController.class).warn("Erreur lors du calcul automatique des marges: {}", e.getMessage());
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

        // Gestion du conditionnement (optionnel)
        if (uniteConditionnementId != null) {
            Optional<Unite> uniteOpt = uniteService.findById(uniteConditionnementId);
            if (uniteOpt.isPresent()) {
                produit.setUnite(uniteOpt.get());
            } else {
                java.util.Map<String, Object> err = new java.util.HashMap<>();
                err.put("error", "Unité de conditionnement non trouvée.");
                return ResponseEntity.badRequest().body(err);
            }
        }
        if (nombreUnitesParConditionnement != null && !nombreUnitesParConditionnement.trim().isEmpty()) {
            int nb = Integer.valueOf(nombreUnitesParConditionnement);
            if (nb <= 0) {
                java.util.Map<String, Object> err = new java.util.HashMap<>();
                err.put("error", "nombreUnitesParConditionnement doit être >= 1");
                return ResponseEntity.badRequest().body(err);
            }
            produit.setNombreUnitesParConditionnement(nb);
        } else {
            // default to 1 (unit-only)
            produit.setNombreUnitesParConditionnement(1);
        }

        // Calcul du stock réel en unité de base
        int quantiteInitialeInt = quantiteInitiale.isEmpty() ? 0 : Integer.valueOf(quantiteInitiale);
        int stockReel = quantiteInitialeInt;
        if (produit.getNombreUnitesParConditionnement() != null && produit.getNombreUnitesParConditionnement() > 0) {
            stockReel = quantiteInitialeInt * produit.getNombreUnitesParConditionnement();
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
                stock.setQuantiteDisponible(stockReel);
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
                    stock.setQuantiteDisponible(stockReel);
                    stockService.saveStock(stock);
                }
            }
        }

        return ResponseEntity.ok(savedProduit);
    }

    @PostMapping("/create")
    public ResponseEntity<?> createProduitWithConditionnement(@RequestBody ProduitCreateDTO dto) {
        Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && !hasPermission(current, "PRODUIT_CREER")) {
            return ResponseEntity.status(403).body("Permission manquante : PRODUIT_CREER");
        }

        try {
            org.slf4j.LoggerFactory.getLogger(ProduitController.class).warn("createProduitWithConditionnement called by user={} boutiqueId={} dto={}", current.getEmail(), current.getBoutique() != null ? current.getBoutique().getId() : null, dto);
            Produit produit = produitService.create(dto, current.getBoutique().getId());
            return ResponseEntity.ok(produit);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Erreur lors de la création : " + e.getMessage());
        }
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
                                                 @RequestParam(value = "uniteConditionnementId", required = false) Long uniteConditionnementId,
                                                 @RequestParam(value = "nombreUnitesParConditionnement", required = false) String nombreUnitesParConditionnement,
                                                 @RequestParam(value = "quantiteInitiale", required = false) String quantiteInitiale,
                                                 @RequestParam(value = "magasinIds", required = false) List<Long> magasinIds) throws IOException {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "PRODUIT_MODIFIER") && !isSuperAdmin(current)) {
            return ResponseEntity.status(403).body("Permission manquante : PRODUIT_MODIFIER");
        }
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

                    // Normalize productImage: if it's a full URL to our uploads, extract filename
                    if (produit.getProductImage() != null && produit.getProductImage().startsWith("http://localhost:8085/uploads/products/")) {
                        produit.setProductImage(produit.getProductImage().substring("http://localhost:8085/uploads/products/".length()));
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

                    // Gestion du conditionnement (optionnel)
                    if (uniteConditionnementId != null) {
                        Optional<Unite> uniteOpt = uniteService.findById(uniteConditionnementId);
                        if (uniteOpt.isPresent()) {
                            produit.setUnite(uniteOpt.get());
                        } else {
                            java.util.Map<String, Object> err = new java.util.HashMap<>();
                            err.put("error", "Unité de conditionnement non trouvée.");
                            return ResponseEntity.badRequest().body(err);
                        }
                    } else {
                        produit.setUnite(null);
                    }
                    if (nombreUnitesParConditionnement != null && !nombreUnitesParConditionnement.trim().isEmpty()) {
                        int nb = Integer.valueOf(nombreUnitesParConditionnement);
                        if (nb <= 0) {
                            java.util.Map<String, Object> err = new java.util.HashMap<>();
                            err.put("error", "nombreUnitesParConditionnement doit être >= 1");
                            return ResponseEntity.badRequest().body(err);
                        }
                        produit.setNombreUnitesParConditionnement(nb);
                    } else {
                        produit.setNombreUnitesParConditionnement(1);
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
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "PRODUIT_SUPPRIMER") && !isSuperAdmin(current)) {
            return ResponseEntity.status(403).build();
        }
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
    public ResponseEntity<?> importFromExcel(@RequestParam("file") MultipartFile file) {
        Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && !hasPermission(current, "PRODUIT_CREER")) {
            return ResponseEntity.status(403).body("Permission manquante : PRODUIT_CREER");
        }
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

    private void enrichProduitResponse(Produit produit) {
        if (produit == null) {
            return;
        }

        if (produit.getProductImage() != null && !produit.getProductImage().startsWith("http")) {
            produit.setProductImage("http://localhost:8085/uploads/products/" + produit.getProductImage());
        }

        if (produit.getStocks() != null && !produit.getStocks().isEmpty()) {
            List<Long> ids = produit.getStocks().stream()
                    .map(stock -> stock.getMagasin() != null ? stock.getMagasin().getId() : null)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
            produit.setMagasinIds(ids);

            List<Map<String, Object>> magasinStocks = produit.getStocks().stream()
                .filter(stock -> stock.getMagasin() != null)
                .map(stock -> {
                Map<String, Object> map = new HashMap<>();
                map.put("id", stock.getMagasin().getId());
                map.put("nom", stock.getMagasin().getNom());
                map.put("adresse", stock.getMagasin().getAdresse());
                map.put("quantiteDisponible", stock.getQuantiteDisponible());
                return map;
                })
                .collect(Collectors.toList());
            produit.setMagasinStocks(magasinStocks);

            Integer quantiteDisponible = produit.getStocks().stream()
                    .map(stock -> stock.getQuantiteDisponible())
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse(null);

            if (quantiteDisponible != null) {
                Integer nbUnitesParConditionnement = produit.getNombreUnitesParConditionnement();
                if (nbUnitesParConditionnement != null && nbUnitesParConditionnement > 0) {
                    produit.setQuantiteInitialeConditionnements(quantiteDisponible / nbUnitesParConditionnement);
                } else {
                    produit.setQuantiteInitialeConditionnements(quantiteDisponible);
                }
            }
        }
    }
}





