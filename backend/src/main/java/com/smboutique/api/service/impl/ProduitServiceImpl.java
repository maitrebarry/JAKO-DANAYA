package com.smboutique.api.service.impl;

import com.smboutique.api.model.Produit;
import com.smboutique.api.model.Unite;
import com.smboutique.api.model.Magasin;
import com.smboutique.api.model.Stock;
import com.smboutique.api.repository.UniteRepository;
import com.smboutique.api.repository.MagasinRepository;
import com.smboutique.api.repository.ProduitRepository;
import com.smboutique.api.service.ProduitService;
import com.smboutique.api.dto.ImportResult;
import com.smboutique.api.dto.ProduitCreateDTO;
import org.springframework.transaction.annotation.Transactional;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import java.util.Optional;

@Service
public class ProduitServiceImpl implements ProduitService {

    @Autowired
    private ProduitRepository produitRepository;
    @Autowired
    private UniteRepository uniteRepository;
    @Autowired
    private MagasinRepository magasinRepository;
    @Autowired
    private com.smboutique.api.service.StockService stockService;

    @Autowired
    private com.smboutique.api.service.ConfigurationMargeService configurationMargeService;

    @Autowired
    private com.smboutique.api.repository.BoutiqueRepository boutiqueRepository;

    @PersistenceContext
    private EntityManager em;

    @Override
    public List<Produit> findAll() {
        return produitRepository.findAll();
    }

    @Override
    public Optional<Produit> findById(Long id) {
        return produitRepository.findById(id);
    }

    @Override
    public Produit save(Produit produit) {
        return produitRepository.save(produit);
    }

    @Override
    @Transactional
    public Produit create(ProduitCreateDTO dto, Long boutiqueId) {
        org.slf4j.LoggerFactory.getLogger(ProduitServiceImpl.class).warn("ProduitService.create called with dto={} boutiqueId={}", dto, boutiqueId);
        Produit produit = new Produit();
        produit.setNomProduit(dto.getNomProduit());
        produit.setProductImage(dto.getProductImage());
        produit.setCaracteristique(dto.getCaracteristique());
        produit.setPrixDetail(dto.getPrixDetail());
        produit.setPrixEnGros(dto.getPrixEnGros());
        produit.setPrixAchat(dto.getPrixAchat());
        produit.setAlerteStock(dto.getAlerteStock());

        // Plus d'unité de base obligatoire - seulement conditionnement optionnel

        // Gestion du conditionnement
        if (dto.getUniteConditionnementId() != null) {
            Unite unite = uniteRepository.findById(dto.getUniteConditionnementId()).orElse(null);
            produit.setUnite(unite);
        }
        int nombreUnites = dto.getNombreUnitesParConditionnement() != null ? dto.getNombreUnitesParConditionnement() : 1;
        produit.setNombreUnitesParConditionnement(nombreUnites);

        // Calcul du stock réel en unité de base
        int stockReel = (dto.getQuantiteInitiale() != null ? dto.getQuantiteInitiale() : 0) * nombreUnites;

        // Avant sauvegarde: si le front n'a pas fourni les prix calculés, tenter un calcul automatique
        try {
            if (produit.getPrixAchat() != null && (produit.getPrixEnGros() == null || produit.getPrixDetail() == null)) {
                org.slf4j.LoggerFactory.getLogger(ProduitServiceImpl.class).warn("Attempt margin compute in service: boutiqueId={}, prixAchat={}, prixEnGros={}, prixDetail={}", boutiqueId, produit.getPrixAchat(), produit.getPrixEnGros(), produit.getPrixDetail());
                com.smboutique.api.model.ConfigurationMarge cfg = configurationMargeService.findByBoutiqueId(boutiqueId).orElse(null);
                if (cfg == null) {
                    org.slf4j.LoggerFactory.getLogger(ProduitServiceImpl.class).info("No configuration marge found in service for boutique {}", boutiqueId);
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

                    org.slf4j.LoggerFactory.getLogger(ProduitServiceImpl.class).warn("Computed marges in service for boutique {}: gros={}, detail={}, margG={}, margD={}", boutiqueId, prixGrosComputed, prixDetailComputed, prixGrosComputed - prixAchatVal, prixDetailComputed - prixAchatVal);

                    if (produit.getPrixEnGros() == null) produit.setPrixEnGros(prixGrosComputed);
                    if (produit.getPrixDetail() == null) produit.setPrixDetail(prixDetailComputed);
                    produit.setMargeGros(java.math.BigDecimal.valueOf(Math.max(prixGrosComputed - prixAchatVal, 0)));
                    produit.setMargeDetail(java.math.BigDecimal.valueOf(Math.max(prixDetailComputed - prixAchatVal, 0)));
                }
            }
        } catch (Exception ex) {
            org.slf4j.LoggerFactory.getLogger(ProduitServiceImpl.class).warn("Erreur calcul marge automatique (import/DTO): {}", ex.getMessage());
        }

        // Sauvegarder le produit d'abord
        Produit savedProduit = produitRepository.save(produit);

        // If after save the computed prices are still null, compute and persist them (defensive)
        try {
            if ((savedProduit.getPrixEnGros() == null || savedProduit.getPrixDetail() == null) && savedProduit.getPrixAchat() != null) {
                com.smboutique.api.model.ConfigurationMarge cfg2 = configurationMargeService.findByBoutiqueId(boutiqueId).orElse(null);
                if (cfg2 != null) {
                    int prixAchatVal = savedProduit.getPrixAchat();
                    int prixGrosComputed = prixAchatVal;
                    int prixDetailComputed = prixAchatVal;
                    if (cfg2.getTypeMarge() == com.smboutique.api.model.ConfigurationMarge.TypeMarge.FIXE) {
                        double vG = cfg2.getValeurGros() != null ? cfg2.getValeurGros().doubleValue() : 0.0;
                        double vD = cfg2.getValeurDetail() != null ? cfg2.getValeurDetail().doubleValue() : 0.0;
                        double minG = cfg2.getMargeMinimaleGros() != null ? cfg2.getMargeMinimaleGros().doubleValue() : 0.0;
                        double minD = cfg2.getMargeMinimaleDetail() != null ? cfg2.getMargeMinimaleDetail().doubleValue() : 0.0;
                        double margG = Math.max(vG, minG);
                        double margD = Math.max(vD, minD);
                        prixGrosComputed = (int)Math.round(prixAchatVal + margG);
                        prixDetailComputed = (int)Math.round(prixAchatVal + margD);
                    } else {
                        double vgPct = cfg2.getValeurGros() != null ? cfg2.getValeurGros().doubleValue() : 0.0;
                        double vdPct = cfg2.getValeurDetail() != null ? cfg2.getValeurDetail().doubleValue() : 0.0;
                        double compG = Math.round(prixAchatVal * vgPct / 100.0);
                        double compD = Math.round(prixAchatVal * vdPct / 100.0);
                        double minG = cfg2.getMargeMinimaleGros() != null ? cfg2.getMargeMinimaleGros().doubleValue() : 0.0;
                        double minD = cfg2.getMargeMinimaleDetail() != null ? cfg2.getMargeMinimaleDetail().doubleValue() : 0.0;
                        double margG = Math.max(compG, minG);
                        double margD = Math.max(compD, minD);
                        prixGrosComputed = (int)Math.round(prixAchatVal + margG);
                        prixDetailComputed = (int)Math.round(prixAchatVal + margD);
                    }
                    org.slf4j.LoggerFactory.getLogger(ProduitServiceImpl.class).warn("Post-save computed marges for boutique {}: gros={}, detail={}", boutiqueId, prixGrosComputed, prixDetailComputed);
                    // Use a native update to guarantee persistence even in complex JPA state situations
                    int updated = em.createNativeQuery("UPDATE tbl_product SET prix_en_gros = :peg, prix_detail = :pd, marge_gros = :mg, marge_detail = :md WHERE id_produit = :id")
                            .setParameter("peg", prixGrosComputed)
                            .setParameter("pd", prixDetailComputed)
                            .setParameter("mg", java.math.BigDecimal.valueOf(Math.max(prixGrosComputed - prixAchatVal, 0)))
                            .setParameter("md", java.math.BigDecimal.valueOf(Math.max(prixDetailComputed - prixAchatVal, 0)))
                            .setParameter("id", savedProduit.getId())
                            .executeUpdate();
                    org.slf4j.LoggerFactory.getLogger(ProduitServiceImpl.class).warn("Post-save margin update executed, rowsAffected={}", updated);
                    // refresh entity
                    em.refresh(savedProduit);
                }
            }
        } catch (Exception ex) {
            org.slf4j.LoggerFactory.getLogger(ProduitServiceImpl.class).warn("Erreur post-save calcul marge automatique: {}", ex.getMessage());
        }

        // Créer le stock initial au niveau BOUTIQUE (magasin = NULL). Le magasin n'intervient pas à la création de produit.
        Stock boutiqueStock = new Stock();
        boutiqueStock.setProduit(savedProduit);
        boutiqueStock.setMagasin(null); // stock global de la boutique
        // set boutique owner and create with zero quantity at product creation
        com.smboutique.api.model.Boutique b = boutiqueRepository.findById(boutiqueId).orElse(null);
        boutiqueStock.setBoutique(b);
        boutiqueStock.setQuantiteDisponible(0);
        // CMP / last purchase intentionally left null until first reception
        boutiqueStock.setCostAverage(null);
        boutiqueStock.setLastPurchasePrice(null);
        stockService.saveStock(boutiqueStock);


        return savedProduit;
    }

    @Override
    public void deleteById(Long id) {
        produitRepository.deleteById(id);
    }

    @Override
    public List<Produit> findByBoutiqueId(Long boutiqueId) {
        return produitRepository.findByBoutiqueId(boutiqueId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ImportResult importFromExcel(MultipartFile file, com.smboutique.api.model.Utilisateur currentUser) throws Exception {
        List<String> errors = new java.util.ArrayList<>();
        int processed = 0;
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Fichier vide");
        }

        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null) throw new IllegalArgumentException("Aucune feuille trouvée dans le fichier Excel");

            // Header row mapping
            Row header = sheet.getRow(0);
            java.util.Map<String, Integer> colIndex = new java.util.HashMap<>();
            for (Cell c : header) {
                colIndex.put(c.getStringCellValue().trim(), c.getColumnIndex());
            }

            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;
                try {
                    // Read values by header names: example headers
                    String nomProduit = getStringCell(row, colIndex.getOrDefault("nomProduit", -1));
                    if (nomProduit == null || nomProduit.trim().isEmpty()) {
                        errors.add("Ligne " + (r+1) + ": nomProduit requis");
                        throw new com.smboutique.api.exception.ImportValidationException(errors);
                    }
                    Integer prixAchat = getIntegerCell(row, colIndex.getOrDefault("prixAchat", -1));

                    // Nouveaux champs pour conditionnements et stock initial
                    Long uniteId = getLongCell(row, colIndex.getOrDefault("id_unite", -1));
                    Integer nombreUnitesParConditionnement = getIntegerCell(row, colIndex.getOrDefault("nombreUnitesParConditionnement", -1));
                    Integer quantiteInitiale = getIntegerCell(row, colIndex.getOrDefault("quantiteInitiale", -1));

                    // Create produit
                    Produit produit = new Produit();
                    produit.setNomProduit(nomProduit);
                    String productImageUrl = getStringCell(row, colIndex.getOrDefault("productImage", -1));
                    String caracteristique = getStringCell(row, colIndex.getOrDefault("caracteristique", -1));
                    if (caracteristique != null && !caracteristique.trim().isEmpty()) {
                        produit.setCaracteristique(caracteristique);
                    }
                    if (productImageUrl != null && !productImageUrl.isEmpty()) {
                        // If value is an HTTP URL, attempt to download and save the image
                        try {
                            if (productImageUrl.startsWith("http://") || productImageUrl.startsWith("https://")) {
                                String uploadDir = "uploads/products/";
                                java.nio.file.Path uploadPath = java.nio.file.Paths.get(uploadDir);
                                if (!java.nio.file.Files.exists(uploadPath)) {
                                    java.nio.file.Files.createDirectories(uploadPath);
                                }
                                java.net.URL url = new java.net.URL(productImageUrl);
                                java.net.URLConnection conn = url.openConnection();
                                conn.setConnectTimeout(10000);
                                conn.setReadTimeout(10000);
                                String contentType = conn.getContentType();
                                String extension = null;
                                if (contentType != null) {
                                    if (contentType.equalsIgnoreCase("image/jpeg") || contentType.equalsIgnoreCase("image/jpg")) extension = ".jpg";
                                    else if (contentType.equalsIgnoreCase("image/png")) extension = ".png";
                                    else if (contentType.equalsIgnoreCase("image/gif")) extension = ".gif";
                                    else if (contentType.equalsIgnoreCase("image/webp")) extension = ".webp";
                                }
                                if (extension == null) {
                                    // try to locate an extension from URL path
                                    String path = url.getPath();
                                    int idx = path.lastIndexOf('.');
                                    if (idx > 0) {
                                        extension = path.substring(idx);
                                    } else {
                                        extension = ".jpg";
                                    }
                                }
                                String fileName = java.util.UUID.randomUUID().toString() + extension;
                                java.nio.file.Path filePath = uploadPath.resolve(fileName);
                                try (java.io.InputStream in = conn.getInputStream()) {
                                    java.nio.file.Files.copy(in, filePath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                                }
                                produit.setProductImage(fileName);
                            } else {
                                // Not a URL - treat as existing filename or relative path
                                produit.setProductImage(productImageUrl);
                            }
                        } catch (Exception ex) {
                            errors.add("Ligne " + (r+1) + ": impossible de télécharger ou sauvegarder l'image depuis " + productImageUrl + " -> " + ex.getMessage());
                            throw new com.smboutique.api.exception.ImportValidationException(errors);
                        }
                    }
                    produit.setPrixAchat(prixAchat);
                    Integer prixDetail = getIntegerCell(row, colIndex.getOrDefault("prixDetail", -1));
                    Integer prixEnGros = getIntegerCell(row, colIndex.getOrDefault("prixEnGros", -1));
                    Integer alerteStock = getIntegerCell(row, colIndex.getOrDefault("alerteStock", -1));
                    produit.setPrixDetail(prixDetail);
                    produit.setPrixEnGros(prixEnGros);
                    // Validate price constraints for import row: prixAchat < prixEnGros < prixDetail
                    if (prixAchat != null && prixEnGros != null && prixAchat >= prixEnGros) {
                        errors.add("Ligne " + (r+1) + ": le prix d'achat doit être inférieur au prix en gros");
                        throw new com.smboutique.api.exception.ImportValidationException(errors);
                    }
                    if (prixEnGros != null && prixDetail != null && prixEnGros >= prixDetail) {
                        errors.add("Ligne " + (r+1) + ": le prix en gros doit être inférieur au prix détail");
                        throw new com.smboutique.api.exception.ImportValidationException(errors);
                    }
                    produit.setAlerteStock(alerteStock);

                    // Définir les conditionnements si fournis
                    if (uniteId != null) {
                        Optional<Unite> uniteOpt = uniteRepository.findById(uniteId);
                        if (uniteOpt.isPresent()) {
                            Unite unite = uniteOpt.get();
                            produit.setUnite(unite);
                            produit.setUniteConditionnement(unite.getLibelle());
                            if (nombreUnitesParConditionnement != null && nombreUnitesParConditionnement > 0) {
                                produit.setNombreUnitesParConditionnement(nombreUnitesParConditionnement);
                            } else {
                                errors.add("Ligne " + (r+1) + ": nombreUnitesParConditionnement requis quand id_unite est fourni");
                                throw new com.smboutique.api.exception.ImportValidationException(errors);
                            }
                        } else {
                            errors.add("Ligne " + (r+1) + ": id_unite '" + uniteId + "' non trouvé");
                            throw new com.smboutique.api.exception.ImportValidationException(errors);
                        }
                    }

                    Produit saved = produitRepository.save(produit);

                    // Create stock for user's boutique/store(s) if magazin id(s) provided
                    // For now: if header magasinId present, create stock
                    String magasinIdsStr = getStringCell(row, colIndex.getOrDefault("magasinIds", -1));

                    // Calculer la quantité réelle initiale
                    int quantiteReel = 0;
                    if (quantiteInitiale != null && quantiteInitiale > 0) {
                        if (nombreUnitesParConditionnement != null && nombreUnitesParConditionnement > 0) {
                            quantiteReel = quantiteInitiale * nombreUnitesParConditionnement;
                        } else {
                            quantiteReel = quantiteInitiale;
                        }
                    }

                    if (magasinIdsStr != null && !magasinIdsStr.isEmpty()) {
                        String[] parts = magasinIdsStr.split(",");
                        for (String p : parts) {
                            try {
                                // Try parsing as integer (excel numeric) or long string
                                Long mgid;
                                try {
                                    mgid = Long.valueOf(p.trim());
                                } catch (NumberFormatException nfe) {
                                    // maybe it was a numeric cell formatted like 1.0
                                    try { mgid = Long.valueOf((long)Double.parseDouble(p.trim())); } catch (Exception ex) { throw nfe; }
                                }
                                Optional<Magasin> magasinOpt = magasinRepository.findById(mgid);
                                if (magasinOpt.isPresent()) {
                                    Stock stock = new Stock();
                                    stock.setProduit(saved);
                                    stock.setMagasin(magasinOpt.get());
                                    stock.setBoutique(magasinOpt.get().getBoutique());
                                    stock.setQuantiteDisponible(quantiteReel);
                                    stockService.saveStock(stock);
                                } else {
                                    errors.add("Ligne " + (r+1) + ": magasinId introuvable: " + mgid);
                                    throw new com.smboutique.api.exception.ImportValidationException(errors);
                                }
                            } catch (NumberFormatException nfe) {
                                errors.add("Ligne " + (r+1) + ": magasinId invalide: " + p);
                                throw new com.smboutique.api.exception.ImportValidationException(errors);
                            }
                        }
                    } else {
                        // No magasin specified: create a single boutique-level stock (magasin = NULL)
                        Stock boutiqueStock = new Stock();
                        boutiqueStock.setProduit(saved);
                        boutiqueStock.setMagasin(null);
                        boutiqueStock.setBoutique(currentUser.getBoutique());
                        boutiqueStock.setQuantiteDisponible(quantiteReel);
                        boutiqueStock.setCostAverage(null);
                        boutiqueStock.setLastPurchasePrice(null);
                        stockService.saveStock(boutiqueStock);
                    }

                    processed++;
                } catch (com.smboutique.api.exception.ImportValidationException e) {
                    // Validation errors: rethrow to cause rollback and provide details upstream
                    throw e;
                } catch (Exception e) {
                    errors.add("Ligne " + (r+1) + ": erreur interne - " + e.getMessage());
                    throw new RuntimeException("Import failed, rolling back. See errors.");
                }
            }
        }

        return new ImportResult(processed, errors);
    }

    private String getStringCell(Row row, Integer idx) {
        if (idx == null || idx < 0) return null;
        Cell c = row.getCell(idx);
        if (c == null) return null;
        if (c.getCellType() == CellType.STRING) return c.getStringCellValue();
        if (c.getCellType() == CellType.NUMERIC) return String.valueOf(c.getNumericCellValue());
        if (c.getCellType() == CellType.BOOLEAN) return String.valueOf(c.getBooleanCellValue());
        return c.toString();
    }

    private Integer getIntegerCell(Row row, Integer idx) {
        if (idx == null || idx < 0) return null;
        Cell c = row.getCell(idx);
        if (c == null) return null;
        if (c.getCellType() == CellType.NUMERIC) {
            return (int) c.getNumericCellValue();
        }
        try { return Integer.parseInt(getStringCell(row, idx)); } catch (Exception e) { return null; }
    }

    private Long getLongCell(Row row, Integer idx) {
        if (idx == null || idx < 0) return null;
        Cell c = row.getCell(idx);
        if (c == null) return null;
        if (c.getCellType() == CellType.NUMERIC) {
            return (long) c.getNumericCellValue();
        }
        try { return Long.parseLong(getStringCell(row, idx)); } catch (Exception e) { return null; }
    }
}
