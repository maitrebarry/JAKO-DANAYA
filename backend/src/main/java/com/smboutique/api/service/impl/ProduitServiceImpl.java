package com.smboutique.api.service.impl;

import com.smboutique.api.model.Produit;
import com.smboutique.api.model.Unite;
import com.smboutique.api.model.Stock;
import com.smboutique.api.repository.UniteRepository;
import com.smboutique.api.repository.ProduitRepository;
import com.smboutique.api.service.ProduitService;
import com.smboutique.api.dto.ImportResult;
import com.smboutique.api.dto.ProduitCreateDTO;
import com.smboutique.api.service.impl.MargeCalculator;
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
import java.text.Normalizer;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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

    @Autowired
    private com.smboutique.api.service.ProduitEmballageService produitEmballageService;

    // Mirrors a produit's flat unite/nombreUnitesParConditionnement fields into a real
    // ProduitEmballage row (flagged default) so products created outside the Produits.tsx
    // list-manager (Excel import, the legacy DTO-based create endpoint) aren't invisible to
    // the multi-emballage system — without this, opening such a product in the new UI later
    // would show an empty emballage list and silently wipe the conditionnement on save.
    private void createDefaultEmballageIfConditionnementSet(Produit produit) {
        if (produit.getUnite() != null && produit.getNombreUnitesParConditionnement() != null && produit.getNombreUnitesParConditionnement() > 0) {
            produitEmballageService.create(produit, produit.getUnite(), produit.getNombreUnitesParConditionnement(), true);
        }
    }

    // Parses the "emballages" Excel column: "Libelle1:Nombre1;Libelle2:Nombre2;..." (e.g.
    // "Carton:24;Sac:6") into resolved (Unite, nombre) pairs, one per product row. Each libelle
    // is resolved/auto-created scoped to the boutique with the same rules as the legacy single
    // id_unite/symbole/unite_name columns. The first pair becomes the product's default emballage.
    private List<Object[]> parseEmballagesColumn(String raw, Long boutiqueId, boolean canAutoCreate, int rowNumberForError, List<String> errors) throws com.smboutique.api.exception.ImportValidationException {
        List<Object[]> result = new java.util.ArrayList<>();
        java.util.Set<String> seenLibelles = new java.util.HashSet<>();
        for (String part : raw.split(";")) {
            String p = part.trim();
            if (p.isEmpty()) continue;
            int idx = p.lastIndexOf(':');
            if (idx <= 0 || idx == p.length() - 1) {
                errors.add("Ligne " + rowNumberForError + ": format invalide dans 'emballages' pour \"" + p + "\" (attendu: Libelle:Nombre, ex: Carton:24)");
                throw new com.smboutique.api.exception.ImportValidationException(errors);
            }
            String libelle = p.substring(0, idx).trim();
            String nombreStr = p.substring(idx + 1).trim();
            int nombre;
            try {
                nombre = Integer.parseInt(nombreStr);
            } catch (NumberFormatException ex) {
                errors.add("Ligne " + rowNumberForError + ": nombre invalide dans 'emballages' pour \"" + p + "\"");
                throw new com.smboutique.api.exception.ImportValidationException(errors);
            }
            if (nombre <= 0) {
                errors.add("Ligne " + rowNumberForError + ": le nombre d'unités doit être supérieur à 0 dans 'emballages' pour \"" + p + "\"");
                throw new com.smboutique.api.exception.ImportValidationException(errors);
            }
            if (!seenLibelles.add(libelle.toLowerCase(Locale.ROOT))) {
                errors.add("Ligne " + rowNumberForError + ": emballage \"" + libelle + "\" répété plusieurs fois dans 'emballages'");
                throw new com.smboutique.api.exception.ImportValidationException(errors);
            }
            Unite unite = uniteService.findByBoutiqueIdAndLibelleIgnoreCase(boutiqueId, libelle).orElse(null);
            if (unite == null) {
                if (canAutoCreate) {
                    unite = uniteService.createIfNotExistsForBoutique(boutiqueId, libelle, libelle, null);
                } else {
                    errors.add("Ligne " + rowNumberForError + ": unité \"" + libelle + "\" introuvable dans 'emballages' et vous n'avez pas la permission de créer des unités");
                    throw new com.smboutique.api.exception.ImportValidationException(errors);
                }
            }
            result.add(new Object[]{unite, nombre});
        }
        if (result.isEmpty()) {
            errors.add("Ligne " + rowNumberForError + ": colonne 'emballages' vide ou mal formée");
            throw new com.smboutique.api.exception.ImportValidationException(errors);
        }
        return result;
    }

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
            com.smboutique.api.model.ConfigurationMarge cfg = configurationMargeService.findByBoutiqueId(boutiqueId).orElse(null);
            if (cfg == null) {
                org.slf4j.LoggerFactory.getLogger(ProduitServiceImpl.class).info("No configuration marge found in service for boutique {}", boutiqueId);
            }
            if (cfg != null && cfg.getTypeMarge() == com.smboutique.api.model.ConfigurationMarge.TypeMarge.MANUEL
                    && produit.getPrixAchat() != null
                    && (produit.getPrixEnGros() != null || produit.getPrixDetail() != null)) {
                MargeCalculator.apply(cfg, produit);
            } else if (produit.getPrixAchat() != null && (produit.getPrixEnGros() == null || produit.getPrixDetail() == null)) {
                org.slf4j.LoggerFactory.getLogger(ProduitServiceImpl.class).warn("Attempt margin compute in service: boutiqueId={}, prixAchat={}, prixEnGros={}, prixDetail={}", boutiqueId, produit.getPrixAchat(), produit.getPrixEnGros(), produit.getPrixDetail());
                if (cfg != null) {
                    int prixAchatVal = produit.getPrixAchat();
                    int prixGrosComputed = prixAchatVal;
                    int prixDetailComputed = prixAchatVal;

                    // Ne calculer les marges que pour FIXE ou POURCENTAGE. Si MANUEL, ignorer le calcul automatique.
                    if (cfg.getTypeMarge() == com.smboutique.api.model.ConfigurationMarge.TypeMarge.FIXE) {
                        double vG = cfg.getValeurGros() != null ? cfg.getValeurGros().doubleValue() : 0.0;
                        double vD = cfg.getValeurDetail() != null ? cfg.getValeurDetail().doubleValue() : 0.0;
                        double minG = cfg.getMargeMinimaleGros() != null ? cfg.getMargeMinimaleGros().doubleValue() : 0.0;
                        double minD = cfg.getMargeMinimaleDetail() != null ? cfg.getMargeMinimaleDetail().doubleValue() : 0.0;
                        double margG = Math.max(vG, minG);
                        double margD = Math.max(vD, minD);
                        prixGrosComputed = (int)Math.round(prixAchatVal + margG);
                        prixDetailComputed = (int)Math.round(prixAchatVal + margD);
                    } else if (cfg.getTypeMarge() == com.smboutique.api.model.ConfigurationMarge.TypeMarge.POURCENTAGE) {
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

        // Si après la sauvegarde les prix calculés sont toujours nuls, les calculer et les persister (défensif)
        try {
            if ((savedProduit.getPrixEnGros() == null || savedProduit.getPrixDetail() == null) && savedProduit.getPrixAchat() != null) {
                com.smboutique.api.model.ConfigurationMarge cfg2 = configurationMargeService.findByBoutiqueId(boutiqueId).orElse(null);
                if (cfg2 != null && cfg2.getTypeMarge() != com.smboutique.api.model.ConfigurationMarge.TypeMarge.MANUEL) {
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
                    } else if (cfg2.getTypeMarge() == com.smboutique.api.model.ConfigurationMarge.TypeMarge.POURCENTAGE) {
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
                    // Utiliser une mise à jour native pour garantir la persistance même dans des cas complexes de l'état JPA
                    int updated = em.createNativeQuery("UPDATE tbl_product SET prix_en_gros = :peg, prix_detail = :pd, marge_gros = :mg, marge_detail = :md WHERE id_produit = :id")
                            .setParameter("peg", prixGrosComputed)
                            .setParameter("pd", prixDetailComputed)
                            .setParameter("mg", java.math.BigDecimal.valueOf(Math.max(prixGrosComputed - prixAchatVal, 0)))
                            .setParameter("md", java.math.BigDecimal.valueOf(Math.max(prixDetailComputed - prixAchatVal, 0)))
                            .setParameter("id", savedProduit.getId())
                            .executeUpdate();
                    org.slf4j.LoggerFactory.getLogger(ProduitServiceImpl.class).warn("Post-save margin update executed, rowsAffected={}", updated);
                    // actualiser l'entité
                    em.refresh(savedProduit);
                }
            }
        } catch (Exception ex) {
            org.slf4j.LoggerFactory.getLogger(ProduitServiceImpl.class).warn("Erreur post-save calcul marge automatique: {}", ex.getMessage());
        }

        createDefaultEmballageIfConditionnementSet(savedProduit);

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
        // Valeur par défaut compatible rétroactivement : ne PAS créer les unités manquantes sauf si le client le demande explicitement.
        return importFromExcel(file, currentUser, false);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ImportResult importFromExcel(MultipartFile file, com.smboutique.api.model.Utilisateur currentUser, boolean createMissingUnits) throws Exception {
        return importFromExcelInternal(file, currentUser, createMissingUnits, null);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ImportResult importFromExcel(MultipartFile file, com.smboutique.api.model.Utilisateur currentUser, boolean createMissingUnits, String jobId) throws Exception {
        return importFromExcelInternal(file, currentUser, createMissingUnits, jobId);
    }

    // Internal implementation that optionally updates an in-memory job status when jobId != null
    @Transactional(rollbackFor = Exception.class)
    protected ImportResult importFromExcelInternal(MultipartFile file, com.smboutique.api.model.Utilisateur currentUser, boolean createMissingUnits, String jobId) throws Exception {
        List<String> errors = new java.util.ArrayList<>();
        int processed = 0;
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Fichier vide");
        }

        // Si cette exécution est associée à un job, initialiser le statut
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

            // Correspondance de la ligne d'en-tête
            Row header = sheet.getRow(0);
            Map<String, Integer> colIndex = new HashMap<>();
            for (Cell c : header) {
                String cellValue = getHeaderCellValue(c);
                String canonicalHeader = canonicalHeader(cellValue);
                if (!canonicalHeader.isEmpty() && !colIndex.containsKey(canonicalHeader)) {
                    colIndex.put(canonicalHeader, c.getColumnIndex());
                }
            }

            Integer totalRows = sheet.getLastRowNum() > 0 ? sheet.getLastRowNum() : null;
            Long importBoutiqueId = currentUser != null && currentUser.getBoutique() != null ? currentUser.getBoutique().getId() : null;
            com.smboutique.api.model.ConfigurationMarge importMargeCfg = importBoutiqueId != null ? configurationMargeService.findByBoutiqueId(importBoutiqueId).orElse(null) : null;
            if (jobId != null) {
                com.smboutique.api.dto.ImportJobStatus s = importJobs.get(jobId);
                if (s != null) s.setTotalRows(totalRows);
            }

            // Détecter si c'est un fichier exporté (contient colonne ID) pour ajuster la validation
            boolean isExportedFile = colIndex.containsKey("id");

            // Télécharger toutes les images distinctes (colonne productImage) EN PARALLÈLE avant de
            // traiter les lignes une à une : avec un import de 100 produits, ça évite ~100 téléchargements
            // séquentiels (potentiellement plusieurs minutes) et fait chuter le temps réel à la durée du
            // téléchargement le plus lent, pas à leur somme. Occupe 2-60% de la barre de progression.
            Map<String, String> prefetchedImages = prefetchProductImages(sheet, colIndex, jobId);

            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;
                try {
                    // mettre à jour la progression de l'enregistrement (60-99% ; 2-60% déjà consommés par
                    // le téléchargement des images ci-dessus)
                    if (jobId != null) {
                        com.smboutique.api.dto.ImportJobStatus s = importJobs.get(jobId);
                        if (s != null && totalRows != null && totalRows > 0) {
                            int pct = 60 + Math.min(39, Math.round((processed * 39f) / totalRows));
                            s.setProgress(pct);
                            s.setPhase("enregistrement");
                            s.setProcessedCount(processed);
                        }
                    }

                    // Lire les valeurs par nom de colonne : en-têtes d'exemple
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

                    // Pour les fichiers exportés, définir des valeurs par défaut si les colonnes sont manquantes
                    if (isExportedFile) {
                        if (quantiteInitiale == null) quantiteInitiale = 0; // Pas de stock initial pour les exports
                        if (nombreUnitesParConditionnement == null) {
                            nombreUnitesParConditionnement = getIntegerCell(row, colIndex.getOrDefault("nombreUnitesParConditionnement", -1));
                            if (nombreUnitesParConditionnement == null) nombreUnitesParConditionnement = 1; // Défaut
                        }
                    }

                    // Create produit
                    Produit produit = new Produit();
                    produit.setNomProduit(nomProduit);
                    String productImageUrl = getStringCell(row, colIndex.getOrDefault("productImage", -1));
                    String caracteristique = getStringCell(row, colIndex.getOrDefault("caracteristique", -1));
                    if (caracteristique != null && !caracteristique.trim().isEmpty()) {
                        produit.setCaracteristique(caracteristique);
                    }
                    if (productImageUrl != null && !productImageUrl.isEmpty()) {
                        if (productImageUrl.startsWith("http://") || productImageUrl.startsWith("https://")) {
                            // Déjà téléchargée en parallèle par prefetchProductImages() ci-dessus : on ne
                            // refait pas d'appel réseau ici, on lit juste le résultat.
                            String localPath = prefetchedImages.get(productImageUrl);
                            if (localPath == null) {
                                errors.add("Ligne " + (r+1) + ": impossible de télécharger ou sauvegarder l'image depuis " + productImageUrl);
                                throw new com.smboutique.api.exception.ImportValidationException(errors);
                            }
                            produit.setProductImage(localPath);
                        } else {
                            // Pas une URL - traiter comme un nom de fichier existant ou un chemin relatif
                            produit.setProductImage(productImageUrl);
                        }
                    }
                    produit.setPrixAchat(prixAchat);
                    Integer prixDetail = getIntegerCell(row, colIndex.getOrDefault("prixDetail", -1));
                    Integer prixEnGros = getIntegerCell(row, colIndex.getOrDefault("prixEnGros", -1));
                    Integer alerteStock = getIntegerCell(row, colIndex.getOrDefault("alerteStock", -1));
                    produit.setPrixDetail(prixDetail);
                    produit.setPrixEnGros(prixEnGros);
                    // Validate price constraints for import row: prixAchat < prixEnGros < prixDetail
                    // Pour les fichiers exportés, être moins strict sur les contraintes de prix
                    if (!isExportedFile) {
                        if (prixAchat != null && prixEnGros != null && prixAchat >= prixEnGros) {
                            errors.add("Ligne " + (r+1) + ": le prix d'achat doit être inférieur au prix en gros");
                            throw new com.smboutique.api.exception.ImportValidationException(errors);
                        }
                        if (prixEnGros != null && prixDetail != null && prixEnGros >= prixDetail) {
                            errors.add("Ligne " + (r+1) + ": le prix en gros doit être inférieur au prix détail");
                            throw new com.smboutique.api.exception.ImportValidationException(errors);
                        }
                    }
                    if (importMargeCfg != null && importMargeCfg.getTypeMarge() == com.smboutique.api.model.ConfigurationMarge.TypeMarge.MANUEL
                            && prixAchat != null && (prixEnGros != null || prixDetail != null)) {
                        MargeCalculator.apply(importMargeCfg, produit);
                    }
                    produit.setAlerteStock(alerteStock);

                    // Définir les conditionnements si fournis
                    // Nouvelle colonne "emballages" : permet plusieurs conditionnements simultanés
                    // pour un même produit (ex: "Carton:24;Sac:6"). Prioritaire sur les anciennes
                    // colonnes id_unite/symbole/unite_name quand elle est renseignée sur la ligne ;
                    // sinon, comportement inchangé pour rester rétrocompatible avec les anciens fichiers.
                    String emballagesRaw = getStringCell(row, colIndex.getOrDefault("emballages", -1));
                    Long boutiqueIdForUnite = currentUser != null && currentUser.getBoutique() != null ? currentUser.getBoutique().getId() : null;
                    boolean canAutoCreateUnite = (currentUser != null && (currentUser.getRoles() != null && currentUser.getRoles().stream().anyMatch(role -> "SUPERADMIN".equalsIgnoreCase(role.getName()))))
                            || (currentUser != null && currentUser.getPermissions() != null && currentUser.getPermissions().stream().anyMatch(perm -> "UNITE_CREER".equalsIgnoreCase(perm.getName())))
                            || isExportedFile;
                    List<Object[]> multiEmballages = null;

                    if (emballagesRaw != null && !emballagesRaw.trim().isEmpty()) {
                        multiEmballages = parseEmballagesColumn(emballagesRaw.trim(), boutiqueIdForUnite, canAutoCreateUnite, r + 1, errors);
                    } else {
                    // accept both legacy `unite_code` and the preferred `symbole` (backwards-compatible)
                    String uniteCode = getStringCell(row, colIndex.getOrDefault("unite_code", -1));
                    String uniteSymbole = getStringCell(row, colIndex.getOrDefault("symbole", -1));
                    String uniteName = getStringCell(row, colIndex.getOrDefault("unite_name", -1));

                    // Pour les fichiers exportés, essayer aussi la colonne "Unité"
                    if (isExportedFile && uniteName == null) {
                        uniteName = getStringCell(row, colIndex.getOrDefault("unite_name", -1));
                    }

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
                        // Essayer de résoudre par symbole/code -> nom (scopé à la boutique)
                        com.smboutique.api.model.Unite resolved = null;
                        Long boutiqueId = currentUser != null && currentUser.getBoutique() != null ? currentUser.getBoutique().getId() : null;
                        // préférer `symbole` (nouveau nom de colonne), revenir à l'ancien `unite_code` si nécessaire
                        String incomingSymbolOrCode = (uniteSymbole != null && !uniteSymbole.trim().isEmpty()) ? uniteSymbole.trim() : (uniteCode != null ? uniteCode.trim() : null);
                        if (incomingSymbolOrCode != null && !incomingSymbolOrCode.isEmpty()) {
                            // la méthode du repository existant recherche par champ code dans la BD — traiter `symbole` comme un alias de cela
                            resolved = uniteService.findByBoutiqueIdAndCode(boutiqueId, incomingSymbolOrCode).orElse(null);
                        }
                        if (resolved == null && uniteName != null && !uniteName.trim().isEmpty()) {
                            resolved = uniteService.findByBoutiqueIdAndLibelleIgnoreCase(boutiqueId, uniteName.trim()).orElse(null);
                        }

                        boolean canAutoCreate = (currentUser != null && (currentUser.getRoles() != null && currentUser.getRoles().stream().anyMatch(role -> "SUPERADMIN".equalsIgnoreCase(role.getName()))))
                                || (currentUser != null && currentUser.getPermissions() != null && currentUser.getPermissions().stream().anyMatch(perm -> "UNITE_CREER".equalsIgnoreCase(perm.getName())))
                                || isExportedFile; // Pour les fichiers exportés, permettre la création automatique d'unités

                        if (resolved == null && (incomingSymbolOrCode != null && !incomingSymbolOrCode.isEmpty() || uniteName != null && !uniteName.trim().isEmpty())) {
                            if (canAutoCreate) {
                                // créer l'unité au niveau de la boutique (idempotent)
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
                    }

                    Produit saved = produitRepository.save(produit);
                    if (multiEmballages != null) {
                        boolean firstEmballage = true;
                        for (Object[] pair : multiEmballages) {
                            Unite u = (Unite) pair[0];
                            Integer n = (Integer) pair[1];
                            produitEmballageService.create(saved, u, n, firstEmballage);
                            firstEmballage = false;
                        }
                    } else {
                        createDefaultEmballageIfConditionnementSet(saved);
                    }

                    // Calculer la quantité réelle initiale : exprimée en unités du conditionnement
                    // par défaut (premier "emballages" listé, ou l'ancienne colonne nombreUnitesParConditionnement)
                    int quantiteReel = 0;
                    Integer effectiveMultiplierForStock = (multiEmballages != null && !multiEmballages.isEmpty())
                            ? (Integer) multiEmballages.get(0)[1]
                            : nombreUnitesParConditionnement;
                    if (quantiteInitiale != null && quantiteInitiale > 0) {
                        if (effectiveMultiplierForStock != null && effectiveMultiplierForStock > 0) {
                            quantiteReel = quantiteInitiale * effectiveMultiplierForStock;
                        } else {
                            quantiteReel = quantiteInitiale;
                        }
                    }

                    // Créer le stock au niveau de la boutique (aucun magasin spécifique)
                    Stock boutiqueStock = new Stock();
                    boutiqueStock.setProduit(saved);
                    boutiqueStock.setMagasin(null);
                    boutiqueStock.setBoutique(currentUser != null ? currentUser.getBoutique() : null);
                    boutiqueStock.setQuantiteDisponible(quantiteReel);
                    initializeStockValuationFromProduct(boutiqueStock, saved);
                    stockService.saveStock(boutiqueStock);

                    processed++;
                } catch (com.smboutique.api.exception.ImportValidationException e) {
                    // Erreurs de validation : relancer pour provoquer un rollback et fournir les détails en amont
                    throw e;
                } catch (Exception e) {
                    errors.add("Ligne " + (r+1) + ": erreur interne - " + e.getMessage());
                    throw new RuntimeException("Import failed, rolling back. See errors.");
                }
            }
        }

        return new ImportResult(processed, errors);
    }

    // Télécharge une seule image (URL http/https) et la sauvegarde sous uploads/products/,
    // en retournant le chemin public ("/uploads/products/xxx.jpg"). Utilisé en parallèle par
    // prefetchProductImages() ; ne touche à aucune entité JPA (sûr à appeler hors transaction/
    // depuis plusieurs threads en même temps).
    private String downloadImageToLocalPath(String imageUrl) throws Exception {
        String uploadDir = "uploads/products/";
        java.nio.file.Path uploadPath = java.nio.file.Paths.get(uploadDir);
        if (!java.nio.file.Files.exists(uploadPath)) {
            java.nio.file.Files.createDirectories(uploadPath);
        }
        java.net.URL url = new java.net.URL(imageUrl);
        java.net.URLConnection conn = url.openConnection();
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(10000);
        // Beaucoup d'hébergeurs d'images (Wikimedia, certains CDN anti-bot...) renvoient un 403
        // au user-agent par défaut de Java ("Java/21...") sans jamais l'indiquer autrement qu'en
        // échec de lecture du flux : un user-agent de navigateur standard passe partout.
        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36");
        String contentType = conn.getContentType();
        String extension = null;
        if (contentType != null) {
            if (contentType.equalsIgnoreCase("image/jpeg") || contentType.equalsIgnoreCase("image/jpg")) extension = ".jpg";
            else if (contentType.equalsIgnoreCase("image/png")) extension = ".png";
            else if (contentType.equalsIgnoreCase("image/gif")) extension = ".gif";
            else if (contentType.equalsIgnoreCase("image/webp")) extension = ".webp";
        }
        if (extension == null) {
            // essayer de localiser une extension à partir du chemin de l'URL
            String path = url.getPath();
            int idx = path.lastIndexOf('.');
            extension = idx > 0 ? path.substring(idx) : ".jpg";
        }
        String fileName = java.util.UUID.randomUUID().toString() + extension;
        java.nio.file.Path filePath = uploadPath.resolve(fileName);
        try (java.io.InputStream in = conn.getInputStream()) {
            java.nio.file.Files.copy(in, filePath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }
        return "/uploads/products/" + fileName;
    }

    // Scanne toute la colonne productImage, déduplique les URL http(s) distinctes, et les télécharge
    // TOUTES EN PARALLÈLE (pool dédié, jusqu'à 12 téléchargements simultanés) avant que la boucle
    // ligne-par-ligne ne commence. Sans ça, importer 100 produits avec image = jusqu'à 100
    // téléchargements séquentiels (potentiellement plusieurs minutes) ; en parallèle, le temps total
    // se rapproche de la durée du téléchargement le plus lent plutôt que de leur somme.
    // Met à jour le statut du job (phase "images", progression 2-60%) si jobId != null.
    private Map<String, String> prefetchProductImages(Sheet sheet, Map<String, Integer> colIndex, String jobId) {
        Integer imgCol = colIndex.get("productImage");
        Map<String, String> result = new java.util.concurrent.ConcurrentHashMap<>();
        if (imgCol == null || imgCol < 0) {
            return result;
        }

        java.util.LinkedHashSet<String> distinctUrls = new java.util.LinkedHashSet<>();
        for (int r = 1; r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;
            String v = getStringCell(row, imgCol);
            if (v != null && (v.startsWith("http://") || v.startsWith("https://"))) {
                distinctUrls.add(v);
            }
        }

        if (jobId != null) {
            com.smboutique.api.dto.ImportJobStatus s = importJobs.get(jobId);
            if (s != null) {
                s.setPhase("images");
                s.setImagesTotal(distinctUrls.size());
                s.setImagesDone(0);
                s.setProgress(distinctUrls.isEmpty() ? 60 : 2);
            }
        }

        if (distinctUrls.isEmpty()) {
            return result;
        }

        int poolSize = Math.max(1, Math.min(12, distinctUrls.size()));
        java.util.concurrent.ExecutorService imagePool = java.util.concurrent.Executors.newFixedThreadPool(poolSize);
        java.util.concurrent.atomic.AtomicInteger done = new java.util.concurrent.atomic.AtomicInteger(0);
        int total = distinctUrls.size();
        try {
            List<java.util.concurrent.Future<?>> futures = new java.util.ArrayList<>();
            for (String imageUrl : distinctUrls) {
                futures.add(imagePool.submit(() -> {
                    try {
                        result.put(imageUrl, downloadImageToLocalPath(imageUrl));
                    } catch (Exception ex) {
                        // pas de valeur -> la ligne concernée sera signalée en erreur lors du traitement
                        org.slf4j.LoggerFactory.getLogger(ProduitServiceImpl.class)
                                .warn("Échec du téléchargement de l'image {} pendant l'import : {}", imageUrl, ex.getMessage());
                    } finally {
                        int nowDone = done.incrementAndGet();
                        if (jobId != null) {
                            com.smboutique.api.dto.ImportJobStatus s = importJobs.get(jobId);
                            if (s != null) {
                                s.setImagesDone(nowDone);
                                s.setProgress(2 + Math.min(58, Math.round((nowDone * 58f) / total)));
                            }
                        }
                    }
                }));
            }
            for (java.util.concurrent.Future<?> f : futures) {
                try { f.get(); } catch (Exception ignored) { /* déjà journalisé ci-dessus */ }
            }
        } finally {
            imagePool.shutdown();
        }

        return result;
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

    private String getHeaderCellValue(Cell cell) {
        if (cell == null) return null;
        if (cell.getCellType() == CellType.STRING) return cell.getStringCellValue();
        if (cell.getCellType() == CellType.NUMERIC) return String.valueOf(cell.getNumericCellValue());
        if (cell.getCellType() == CellType.BOOLEAN) return String.valueOf(cell.getBooleanCellValue());
        return cell.toString();
    }

    private static final Map<String, String> HEADER_ALIASES = Map.ofEntries(
            Map.entry("nom", "nomProduit"),
            Map.entry("nomproduit", "nomProduit"),
            Map.entry("id", "id"),
            Map.entry("idproduit", "id"),
            Map.entry("prixachat", "prixAchat"),
            Map.entry("prixdachat", "prixAchat"),
            Map.entry("prixengros", "prixEnGros"),
            Map.entry("prixgros", "prixEnGros"),
            Map.entry("prixdetail", "prixDetail"),
            Map.entry("prixdétail", "prixDetail"),
            Map.entry("prixdétails", "prixDetail"),
            Map.entry("unite", "unite_name"),
            Map.entry("unitecode", "unite_code"),
            Map.entry("symbole", "symbole"),
            Map.entry("unitename", "unite_name"),
            Map.entry("unitenom", "unite_name"),
            Map.entry("unite_name", "unite_name"),
            Map.entry("nombreunitesparconditionnement", "nombreUnitesParConditionnement"),
            Map.entry("quantiteinitiale", "quantiteInitiale"),
            Map.entry("idunite", "id_unite"),
            Map.entry("unitescond", "nombreUnitesParConditionnement"),
            Map.entry("unitscond", "nombreUnitesParConditionnement"),
            Map.entry("alerte", "alerteStock"),
            Map.entry("alertestock", "alerteStock"),
            Map.entry("productimage", "productImage"),
            Map.entry("caracteristique", "caracteristique"),
            Map.entry("emballages", "emballages"),
            Map.entry("emballage", "emballages"),
            Map.entry("conditionnements", "emballages")
    );

    private static String normalizeHeader(String header) {
        if (header == null) return "";
        String normalized = Normalizer.normalize(header, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]", "");
        return normalized;
    }

    private static String canonicalHeader(String header) {
        String normalized = normalizeHeader(header);
        return HEADER_ALIASES.getOrDefault(normalized, normalized);
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

                // Créer un wrapper stable de type MultipartFile autour des octets copiés afin
                // de réutiliser le pipeline d'import existant sans modifier davantage la signature.
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
                        // appeler le service proxifié (sémantique @Transactional) en lui passant le jobId
                        // pour que la progression par ligne/par image remonte réellement au statut du job.
                        res = svc.importFromExcel(stableFile, currentUser, createMissingUnits, jobId);
                    } catch (Exception ex) {
                        // revenir à l'implémentation interne en dernier recours (conserve jobId pour le suivi du statut)
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
                    if (ex instanceof com.smboutique.api.exception.ImportValidationException ive && ive.getErrors() != null && !ive.getErrors().isEmpty()) {
                        // ImportValidationException.getMessage() est toujours le texte générique
                        // "Import validation failed" ; le détail utile (numéro de ligne, cause) est
                        // dans getErrors() - sans ça l'utilisateur ne voit jamais pourquoi ça échoue.
                        for (String e : ive.getErrors()) s4.addError(e);
                    } else {
                        s4.addError(ex.getMessage() == null ? ex.toString() : ex.getMessage());
                    }
                }
                // journaliser avec jobId pour faciliter le débogage
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

            // Mêmes 9 colonnes, mêmes noms, même ordre que le modèle d'import (produits_template.xlsx) :
            // un fichier exporté doit pouvoir être réimporté tel quel sans réédition manuelle des en-têtes.
            String[] headers = new String[] {
                    "nomProduit",
                    "prixAchat",
                    "prixDetail",
                    "prixEnGros",
                    "alerteStock",
                    "quantiteInitiale",
                    "emballages",
                    "productImage",
                    "caracteristique"
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

                List<com.smboutique.api.model.ProduitEmballage> emballages = produit.getEmballages() == null
                        ? Collections.emptyList()
                        : produit.getEmballages().stream()
                            .sorted((a, b) -> Boolean.compare(
                                    !Boolean.TRUE.equals(a.getEstParDefaut()),
                                    !Boolean.TRUE.equals(b.getEstParDefaut())))
                            .collect(Collectors.toList());

                String emballagesColumn = emballages.stream()
                        .filter(e -> e.getUnite() != null && e.getUnite().getLibelle() != null && e.getNombreUnites() != null)
                        .map(e -> e.getUnite().getLibelle() + ":" + e.getNombreUnites())
                        .collect(Collectors.joining(";"));

                // quantiteInitiale s'exprime dans l'unité de l'emballage par défaut (comme à l'import) :
                // on convertit donc le stock réel (en unités de base) en nombre de "paquets" par défaut.
                Integer defaultMultiplier = !emballages.isEmpty() && emballages.get(0).getNombreUnites() != null
                        ? emballages.get(0).getNombreUnites()
                        : produit.getNombreUnitesParConditionnement();
                int quantiteInitiale = (defaultMultiplier != null && defaultMultiplier > 0)
                        ? totalStock / defaultMultiplier
                        : totalStock;

                row.createCell(0).setCellValue(produit.getNomProduit() != null ? produit.getNomProduit() : "");
                row.createCell(1).setCellValue(produit.getPrixAchat() != null ? produit.getPrixAchat() : 0);
                row.createCell(2).setCellValue(produit.getPrixDetail() != null ? produit.getPrixDetail() : 0);
                row.createCell(3).setCellValue(produit.getPrixEnGros() != null ? produit.getPrixEnGros() : 0);
                row.createCell(4).setCellValue(produit.getAlerteStock() != null ? produit.getAlerteStock() : 0);
                row.createCell(5).setCellValue(quantiteInitiale);
                row.createCell(6).setCellValue(emballagesColumn);
                row.createCell(7).setCellValue(produit.getProductImage() != null ? produit.getProductImage() : "");
                row.createCell(8).setCellValue(produit.getCaracteristique() != null ? produit.getCaracteristique() : "");
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
