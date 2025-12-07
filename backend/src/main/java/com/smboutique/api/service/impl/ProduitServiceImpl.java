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
import org.springframework.transaction.annotation.Transactional;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
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
                    String uniteLib = getStringCell(row, colIndex.getOrDefault("unite", -1));
                    Integer uniteIdInt = getIntegerCell(row, colIndex.getOrDefault("uniteId", -1));
                    Integer prixAchat = getIntegerCell(row, colIndex.getOrDefault("prixAchat", -1));
                    // Create produit
                    Produit produit = new Produit();
                    produit.setNomProduit(nomProduit);
                    String productImageUrl = getStringCell(row, colIndex.getOrDefault("productImage", -1));
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
                    Unite unite = null;
                    if (uniteIdInt != null) {
                        Long uid = uniteIdInt.longValue();
                        unite = uniteRepository.findById(uid).orElse(null);
                        if (unite == null) {
                            errors.add("Ligne " + (r+1) + ": uniteId introuvable: " + uid);
                            throw new com.smboutique.api.exception.ImportValidationException(errors);
                        }
                    }
                    if (unite == null && uniteLib != null && !uniteLib.isEmpty()) {
                        Optional<Unite> uniteOpt = uniteRepository.findByLibelle(uniteLib);
                        if (!uniteOpt.isPresent()) {
                            unite = new Unite();
                            unite.setLibelle(uniteLib);
                            if (currentUser != null && currentUser.getBoutique() != null) {
                                unite.setBoutique(currentUser.getBoutique());
                            }
                            unite = uniteRepository.save(unite);
                        } else {
                            unite = uniteOpt.get();
                        }
                    }
                    if (unite != null) produit.setUnite(unite);
                    Produit saved = produitRepository.save(produit);

                    // Create stock for user's boutique/store(s) if magazin id(s) provided
                    // For now: if header magasinId present, create stock
                    String magasinIdsStr = getStringCell(row, colIndex.getOrDefault("magasinIds", -1));
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
                                    stock.setQuantiteDisponible(0);
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
                        // No magasin specified: create stocks for all magasins in the user's boutique
                        if (currentUser != null && currentUser.getBoutique() != null) {
                            Long boutiqueId = currentUser.getBoutique().getId();
                            List<Magasin> magasins = magasinRepository.findByBoutiqueId(boutiqueId);
                            for (Magasin mg : magasins) {
                                Stock stock = new Stock();
                                stock.setProduit(saved);
                                stock.setMagasin(mg);
                                stock.setQuantiteDisponible(0);
                                stockService.saveStock(stock);
                            }
                        }
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
}
