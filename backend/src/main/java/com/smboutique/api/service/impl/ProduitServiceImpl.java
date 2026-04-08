package com.smboutique.api.service.impl;

import com.smboutique.api.model.Produit;
import com.smboutique.api.model.Unite;
import com.smboutique.api.model.Stock;
import com.smboutique.api.repository.UniteRepository;
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
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ProduitServiceImpl implements ProduitService {

    @Autowired
    private ProduitRepository produitRepository;
    @Autowired
    private UniteRepository uniteRepository;

    @Autowired
    private com.smboutique.api.service.UniteService uniteService;
    @Autowired
    private com.smboutique.api.service.StockService stockService;

    @Autowired
    private com.smboutique.api.service.ConfigurationMargeService configurationMargeService;

    @Autowired
    private com.smboutique.api.repository.BoutiqueRepository boutiqueRepository;

    @PersistenceContext
    private EntityManager em;

    // --- Async import/job tracking (in-memory, short TTL) ---
    private final java.util.concurrent.ExecutorService importExecutor = java.util.concurrent.Executors.newFixedThreadPool(2);
    private final java.util.Map<String, com.smboutique.api.dto.ImportJobStatus> importJobs = new java.util.concurrent.ConcurrentHashMap<>();

    @org.springframework.beans.factory.annotation.Autowired
    private org.springframework.context.ApplicationContext applicationContext;

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

    private void initializeStockValuationFromProduct(Stock stock, Produit produit) {
        Integer quantity = stock.getQuantiteDisponible();
        if (quantity == null || quantity <= 0 || produit == null || produit.getPrixAchat() == null) {
            return;
        }
        BigDecimal purchasePrice = BigDecimal.valueOf(produit.getPrixAchat());
        stock.setCostAverage(purchasePrice);
        stock.setLastPurchasePrice(purchasePrice);
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
        // set boutique owner and create with the computed initial quantity (in units)
        com.smboutique.api.model.Boutique b = boutiqueRepository.findById(boutiqueId).orElse(null);
        boutiqueStock.setBoutique(b);
        boutiqueStock.setQuantiteDisponible(stockReel);
        initializeStockValuationFromProduct(boutiqueStock, savedProduit);
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
        // Backward-compatible default: do NOT create missing units unless the client explicitly requests it.
        return importFromExcel(file, currentUser, false);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ImportResult importFromExcel(MultipartFile file, com.smboutique.api.model.Utilisateur currentUser, boolean createMissingUnits) throws Exception {
        return importFromExcelInternal(file, currentUser, createMissingUnits, null);
    }

    // Internal implementation that optionally updates an in-memory job status when jobId != null
    @Transactional(rollbackFor = Exception.class)
    protected ImportResult importFromExcelInternal(MultipartFile file, com.smboutique.api.model.Utilisateur currentUser, boolean createMissingUnits, String jobId) throws Exception {
        List<String> errors = new java.util.ArrayList<>();
        int processed = 0;
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Fichier vide");
        }

        // If this execution is associated with a job, initialize job status
        if (jobId != null) {
            com.smboutique.api.dto.ImportJobStatus s = importJobs.get(jobId);
            if (s != null) {
                s.setState(com.smboutique.api.dto.ImportJobStatus.State.RUNNING);
                s.setPhase("parsing");
                s.setProgress(1);
            }
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

            Integer totalRows = sheet.getLastRowNum() > 0 ? sheet.getLastRowNum() : null;
            if (jobId != null) {
                com.smboutique.api.dto.ImportJobStatus s = importJobs.get(jobId);
                if (s != null) s.setTotalRows(totalRows);
            }

            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;
                try {
                    // update parsing progress
                    if (jobId != null) {
                        com.smboutique.api.dto.ImportJobStatus s = importJobs.get(jobId);
                        if (s != null && totalRows != null && totalRows > 0) {
                            int pct = Math.min(99, Math.round((processed * 100f) / totalRows));
                            s.setProgress(pct);
                            s.setPhase("parsing");
                        }
                    }

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
                                produit.setProductImage("/uploads/products/" + fileName);
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
                    // accept both legacy `unite_code` and the preferred `symbole` (backwards-compatible)
                    String uniteCode = getStringCell(row, colIndex.getOrDefault("unite_code", -1));
                    String uniteSymbole = getStringCell(row, colIndex.getOrDefault("symbole", -1));
                    String uniteName = getStringCell(row, colIndex.getOrDefault("unite_name", -1));

                    if (uniteId != null) {
                        Optional<Unite> uniteOpt = uniteRepository.findById(uniteId);
                        if (uniteOpt.isPresent()) {
                            Unite unite = uniteOpt.get();
                            // enforce boutique scoping for IDs
                            if (currentUser != null && currentUser.getBoutique() != null && unite.getBoutique() != null
                                    && !currentUser.getBoutique().getId().equals(unite.getBoutique().getId())
                                    && !(currentUser.getRoles() != null && currentUser.getRoles().stream().anyMatch(role -> "SUPERADMIN".equalsIgnoreCase(role.getName())))) {
                                errors.add("Ligne " + (r+1) + ": id_unite '" + uniteId + "' n'appartient pas à votre boutique");
                                throw new com.smboutique.api.exception.ImportValidationException(errors);
                            }
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
                    } else {
                        // Try resolve by symbole/code -> name (scoped to boutique)
                        com.smboutique.api.model.Unite resolved = null;
                        Long boutiqueId = currentUser != null && currentUser.getBoutique() != null ? currentUser.getBoutique().getId() : null;
                        // prefer `symbole` (new column name), fall back to legacy `unite_code`
                        String incomingSymbolOrCode = (uniteSymbole != null && !uniteSymbole.trim().isEmpty()) ? uniteSymbole.trim() : (uniteCode != null ? uniteCode.trim() : null);
                        if (incomingSymbolOrCode != null && !incomingSymbolOrCode.isEmpty()) {
                            // existing repository method searches by code field in DB — treat `symbole` as an alias for that
                            resolved = uniteService.findByBoutiqueIdAndCode(boutiqueId, incomingSymbolOrCode).orElse(null);
                        }
                        if (resolved == null && uniteName != null && !uniteName.trim().isEmpty()) {
                            resolved = uniteService.findByBoutiqueIdAndLibelleIgnoreCase(boutiqueId, uniteName.trim()).orElse(null);
                        }

                        boolean canAutoCreate = (currentUser != null && (currentUser.getRoles() != null && currentUser.getRoles().stream().anyMatch(role -> "SUPERADMIN".equalsIgnoreCase(role.getName()))))
                                || (currentUser != null && currentUser.getPermissions() != null && currentUser.getPermissions().stream().anyMatch(perm -> "UNITE_CREER".equalsIgnoreCase(perm.getName())));

                        if (resolved == null && (incomingSymbolOrCode != null && !incomingSymbolOrCode.isEmpty() || uniteName != null && !uniteName.trim().isEmpty())) {
                            if (canAutoCreate) {
                                // create unit scoped to boutique (idempotent)
                                resolved = uniteService.createIfNotExistsForBoutique(boutiqueId, incomingSymbolOrCode != null ? incomingSymbolOrCode : uniteName, uniteName, null);
                            } else {
                                errors.add("Ligne " + (r+1) + ": unité introuvable et vous n'avez pas la permission de créer des unités (fournir id_unite, `symbole` ou demander la permission UNITE_CREER)");
                                throw new com.smboutique.api.exception.ImportValidationException(errors);
                            }
                        }

                        if (resolved != null) {
                            produit.setUnite(resolved);
                            produit.setUniteConditionnement(resolved.getLibelle());
                            if (nombreUnitesParConditionnement != null && nombreUnitesParConditionnement > 0) {
                                produit.setNombreUnitesParConditionnement(nombreUnitesParConditionnement);
                            }
                        }
                    }

                    Produit saved = produitRepository.save(produit);

                    // Calculer la quantité réelle initiale
                    int quantiteReel = 0;
                    if (quantiteInitiale != null && quantiteInitiale > 0) {
                        if (nombreUnitesParConditionnement != null && nombreUnitesParConditionnement > 0) {
                            quantiteReel = quantiteInitiale * nombreUnitesParConditionnement;
                        } else {
                            quantiteReel = quantiteInitiale;
                        }
                    }

                    // Create stock at boutique level (no specific magasin)
                    Stock boutiqueStock = new Stock();
                    boutiqueStock.setProduit(saved);
                    boutiqueStock.setMagasin(null);
                    boutiqueStock.setBoutique(currentUser != null ? currentUser.getBoutique() : null);
                    boutiqueStock.setQuantiteDisponible(quantiteReel);
                    initializeStockValuationFromProduct(boutiqueStock, saved);
                    stockService.saveStock(boutiqueStock);

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

    @Override
    public String startAsyncImport(MultipartFile file, com.smboutique.api.model.Utilisateur currentUser, boolean createMissingUnits) {
        String jobId = java.util.UUID.randomUUID().toString();
        com.smboutique.api.dto.ImportJobStatus st = new com.smboutique.api.dto.ImportJobStatus();
        st.setJobId(jobId);
        st.setState(com.smboutique.api.dto.ImportJobStatus.State.PENDING);
        st.setPhase("upload");
        st.setProgress(0);
        importJobs.put(jobId, st);

        /*
         * IMPORTANT: MultipartFile implementations provided by the servlet container
         * may rely on temporary request-scoped storage that is cleaned up when the
         * request thread completes. Because the import runs asynchronously after
         * the controller returns, we must eagerly copy the uploaded bytes here and
         * pass a stable in-memory wrapper to the background task. Otherwise the
         * background worker can observe an empty file (see report: "Fichier vide").
         */
        final byte[] payload;
        try {
            payload = file != null ? file.getBytes() : new byte[0];
        } catch (Exception e) {
            // record and return a jobId so the client can poll for a clear error
            com.smboutique.api.dto.ImportJobStatus failed = importJobs.get(jobId);
            if (failed != null) {
                failed.setState(com.smboutique.api.dto.ImportJobStatus.State.FAILED);
                failed.setPhase("failed");
                failed.setProgress(100);
                failed.addError("Impossible de lire le fichier uploadé: " + e.getMessage());
            }
            return jobId;
        }

        importExecutor.submit(() -> {
            try {
                com.smboutique.api.dto.ImportJobStatus s2 = importJobs.get(jobId);
                if (s2 != null) {
                    s2.setState(com.smboutique.api.dto.ImportJobStatus.State.RUNNING);
                    s2.setPhase("parsing");
                    s2.setProgress(1);
                }

                // Create a stable MultipartFile-like wrapper around the copied bytes so
                // the existing import pipeline can be reused without further signature changes.
                final MultipartFile stableFile = new MultipartFile() {
                    @Override
                    public String getName() { return file == null ? "file" : file.getName(); }
                    @Override
                    public String getOriginalFilename() { return file == null ? null : file.getOriginalFilename(); }
                    @Override
                    public String getContentType() { return file == null ? null : file.getContentType(); }
                    @Override
                    public boolean isEmpty() { return payload == null || payload.length == 0; }
                    @Override
                    public long getSize() { return payload == null ? 0 : payload.length; }
                    @Override
                    public byte[] getBytes() { return payload == null ? new byte[0] : payload; }
                    @Override
                    public java.io.InputStream getInputStream() { return new java.io.ByteArrayInputStream(payload == null ? new byte[0] : payload); }
                    @Override
                    public void transferTo(java.io.File dest) throws java.io.IOException, IllegalStateException {
                        java.nio.file.Files.write(dest.toPath(), payload == null ? new byte[0] : payload);
                    }
                };

                com.smboutique.api.dto.ImportResult res;
                if (applicationContext != null) {
                    try {
                        ProduitService svc = applicationContext.getBean(ProduitService.class);
                        // call proxied service so @Transactional semantics still apply
                        res = svc.importFromExcel(stableFile, currentUser, createMissingUnits);
                    } catch (Exception ex) {
                        // fallback to internal implementation (keeps jobId for status reporting)
                        res = importFromExcelInternal(stableFile, currentUser, createMissingUnits, jobId);
                    }
                } else {
                    res = importFromExcelInternal(stableFile, currentUser, createMissingUnits, jobId);
                }

                com.smboutique.api.dto.ImportJobStatus s3 = importJobs.get(jobId);
                if (s3 != null) {
                    s3.setProcessedCount(res.getProcessedCount());
                    s3.setErrors(res.getErrors());
                    s3.setProgress(100);
                    s3.setPhase("completed");
                    s3.setState(com.smboutique.api.dto.ImportJobStatus.State.COMPLETED);
                }
            } catch (Exception ex) {
                com.smboutique.api.dto.ImportJobStatus s4 = importJobs.get(jobId);
                if (s4 != null) {
                    s4.setState(com.smboutique.api.dto.ImportJobStatus.State.FAILED);
                    s4.setPhase("failed");
                    s4.setProgress(100);
                    s4.addError(ex.getMessage() == null ? ex.toString() : ex.getMessage());
                }
                // log with jobId for easier debugging
                org.slf4j.LoggerFactory.getLogger(ProduitServiceImpl.class).error("Async import job {} failed: {}", jobId, ex.getMessage(), ex);
            }
        });

        return jobId;
    }

    @Override
    public com.smboutique.api.dto.ImportJobStatus getImportJobStatus(String jobId) {
        return importJobs.get(jobId);
    }

    @Override
    public com.smboutique.api.dto.ImportResult getImportJobReport(String jobId) {
        com.smboutique.api.dto.ImportJobStatus s = importJobs.get(jobId);
        if (s == null) throw new IllegalArgumentException("Job not found");
        if (s.getState() != com.smboutique.api.dto.ImportJobStatus.State.COMPLETED) {
            throw new IllegalStateException("Job not completed");
        }
        return new com.smboutique.api.dto.ImportResult(s.getProcessedCount(), s.getErrors());
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] exportProduitsToExcel(Long boutiqueId) {
        if (boutiqueId == null) {
            throw new IllegalArgumentException("boutiqueId requis");
        }

        List<Produit> produits = produitRepository.findByBoutiqueIdWithStocks(boutiqueId);
        if (produits == null) {
            produits = Collections.emptyList();
        }

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Produits");

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            String[] headers = new String[] {
                    "ID",
                    "Nom",
                    "Unité",
                    "Unités/cond.",
                    "Prix achat",
                    "Prix gros",
                    "Prix détail",
                    "Stock total (u.)",
                    "Stock boutique (u.)",
                    "Stocks magasins",
                    "Alerte stock"
            };

            Row header = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = header.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowIdx = 1;
            for (Produit produit : produits) {
                Row row = sheet.createRow(rowIdx++);

                List<Stock> scopedStocks = (produit.getStocks() == null)
                        ? Collections.emptyList()
                        : produit.getStocks().stream()
                        .filter(stock -> stock != null
                                && stock.getBoutique() != null
                                && boutiqueId.equals(stock.getBoutique().getId()))
                        .collect(Collectors.toList());

                int totalStock = scopedStocks.stream()
                        .mapToInt(stock -> stock.getQuantiteDisponible() != null ? stock.getQuantiteDisponible() : 0)
                        .sum();
                int boutiqueStock = scopedStocks.stream()
                        .filter(stock -> stock.getMagasin() == null)
                        .mapToInt(stock -> stock.getQuantiteDisponible() != null ? stock.getQuantiteDisponible() : 0)
                        .sum();
                String magasinDetails = scopedStocks.stream()
                        .filter(stock -> stock.getMagasin() != null)
                        .map(stock -> {
                            String magasinName = stock.getMagasin().getNom() != null ? stock.getMagasin().getNom() : ("Magasin #" + stock.getMagasin().getId());
                            int qty = stock.getQuantiteDisponible() != null ? stock.getQuantiteDisponible() : 0;
                            return magasinName + ": " + qty;
                        })
                        .collect(Collectors.joining(" | "));

                row.createCell(0).setCellValue(produit.getId() != null ? produit.getId() : 0);
                row.createCell(1).setCellValue(produit.getNomProduit() != null ? produit.getNomProduit() : "");
                row.createCell(2).setCellValue(produit.getUnite() != null && produit.getUnite().getLibelle() != null ? produit.getUnite().getLibelle() : "");
                row.createCell(3).setCellValue(produit.getNombreUnitesParConditionnement() != null ? produit.getNombreUnitesParConditionnement() : 0);
                row.createCell(4).setCellValue(produit.getPrixAchat() != null ? produit.getPrixAchat() : 0);
                row.createCell(5).setCellValue(produit.getPrixEnGros() != null ? produit.getPrixEnGros() : 0);
                row.createCell(6).setCellValue(produit.getPrixDetail() != null ? produit.getPrixDetail() : 0);
                row.createCell(7).setCellValue(totalStock);
                row.createCell(8).setCellValue(boutiqueStock);
                row.createCell(9).setCellValue(magasinDetails);
                row.createCell(10).setCellValue(produit.getAlerteStock() != null ? produit.getAlerteStock() : 0);
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Erreur lors de la génération du fichier Excel", e);
        }
    }
}
