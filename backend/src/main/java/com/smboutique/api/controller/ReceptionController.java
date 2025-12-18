package com.smboutique.api.controller;

import com.smboutique.api.dto.ReceptionDTO;
import com.smboutique.api.dto.ReceptionListDTO;
import com.smboutique.api.model.Reception;
import com.smboutique.api.model.LigneCommande;
import com.smboutique.api.model.LigneReception;
import com.smboutique.api.model.Produit;
import com.smboutique.api.model.Stock;
import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.CommandeFournisseur;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.ReceptionService;
import com.smboutique.api.service.CommandeFournisseurService;
import com.smboutique.api.service.LigneReceptionService;
import com.smboutique.api.service.StockService;
import com.smboutique.api.service.ProduitService;
import com.smboutique.api.service.UtilisateurService;
import com.smboutique.api.repository.LigneCommandeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import java.math.BigDecimal;
import java.math.RoundingMode;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/receptions")
@CrossOrigin(origins = "*")
public class ReceptionController {

    private static final Logger logger = LoggerFactory.getLogger(ReceptionController.class);

    @Autowired
    private ReceptionService receptionService;

    @Autowired
    private CommandeFournisseurService commandeFournisseurService;

    @Autowired
    private LigneReceptionService ligneReceptionService;

    @Autowired
    private StockService stockService;

    @Autowired
    private ProduitService produitService;

    @Autowired
    private com.smboutique.api.service.ConfigurationMargeService configurationMargeService;

    @Autowired
    private LigneCommandeRepository ligneCommandeRepository;

    @Autowired
    private UtilisateurService utilisateurService;

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
    public List<Reception> getAllReceptions() {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "RECEPTION_LECTURE")) {
            return List.of(); // Return empty list if no permission
        }
        if (isSuperAdmin(user)) {
            return receptionService.findAll();
        } else {
            return receptionService.findUnfinishedReceptionsByBoutiqueId(user.getBoutique().getId());
        }
    }

    @GetMapping("/unfinished")
    public List<ReceptionListDTO> getUnfinishedReceptions() {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "RECEPTION_LECTURE")) {
            return List.of(); // Return empty list if no permission
        }
        if (isSuperAdmin(user)) {
            return receptionService.findUnfinishedReceptionsList();
        } else {
            return receptionService.findUnfinishedReceptionsListByBoutiqueId(user.getBoutique().getId());
        }
    }

    @GetMapping("/finished")
    public List<ReceptionListDTO> getFinishedReceptions() {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "RECEPTION_LECTURE")) {
            return List.of(); // Return empty list if no permission
        }
        if (isSuperAdmin(user)) {
            return receptionService.findFinishedReceptionsList();
        } else {
            return receptionService.findFinishedReceptionsListByBoutiqueId(user.getBoutique().getId());
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Reception> getReceptionById(@PathVariable Long id) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "RECEPTION_LECTURE")) {
            return ResponseEntity.status(403).build(); // Forbidden
        }

        Optional<Reception> receptionOpt = receptionService.findById(id);
        if (receptionOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Reception reception = receptionOpt.get();

        // Vérifier que la réception appartient à la boutique de l'utilisateur (sauf superadmin)
        if (!isSuperAdmin(user) && !reception.getBoutique().getId().equals(user.getBoutique().getId())) {
            return ResponseEntity.status(403).build(); // Forbidden
        }

        return ResponseEntity.ok(reception);
    }

    @PostMapping
    public Reception createReception(@RequestBody Reception reception) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "RECEPTION_ECRITURE")) {
            throw new RuntimeException("Permission insuffisante pour créer une réception");
        }
        // Assigner automatiquement la boutique de l'utilisateur connecté
        reception.setBoutique(user.getBoutique());
        return receptionService.save(reception);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Reception> updateReception(@PathVariable Long id, @RequestBody Reception receptionDetails) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "RECEPTION_ECRITURE")) {
            logger.warn("Accès refusé à updateReception pour l'utilisateur {}: permission manquante RECEPTION_ECRITURE", user.getEmail());
            return ResponseEntity.status(403).build();
        }

        Optional<Reception> receptionOpt = receptionService.findById(id);
        if (receptionOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Reception reception = receptionOpt.get();

        // Vérifier que la réception appartient à la boutique de l'utilisateur (sauf superadmin)
        if (!isSuperAdmin(user) && !reception.getBoutique().getId().equals(user.getBoutique().getId())) {
            return ResponseEntity.status(403).build(); // Forbidden
        }

        reception.setReference(receptionDetails.getReference());
        reception.setDateReception(receptionDetails.getDateReception());
        reception.setCommandeFournisseur(receptionDetails.getCommandeFournisseur());
        return ResponseEntity.ok(receptionService.save(reception));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteReception(@PathVariable Long id) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "RECEPTION_SUPPRESSION")) {
            return ResponseEntity.status(403).build(); // Forbidden
        }

        Optional<Reception> receptionOpt = receptionService.findById(id);
        if (receptionOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Reception reception = receptionOpt.get();

        // Vérifier que la réception appartient à la boutique de l'utilisateur (sauf superadmin)
        if (!isSuperAdmin(user) && !reception.getBoutique().getId().equals(user.getBoutique().getId())) {
            return ResponseEntity.status(403).build(); // Forbidden
        }

        receptionService.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/detail")
    public ResponseEntity<ReceptionDTO> getReceptionDetail(@PathVariable Long id) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "RECEPTION_LECTURE")) {
            return ResponseEntity.status(403).build(); // Forbidden
        }

        Optional<Reception> receptionOpt = receptionService.findById(id);
        if (receptionOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Reception reception = receptionOpt.get();

        // Vérifier que la réception appartient à la boutique de l'utilisateur (sauf superadmin)
        if (!isSuperAdmin(user) && !reception.getBoutique().getId().equals(user.getBoutique().getId())) {
            return ResponseEntity.status(403).build(); // Forbidden
        }

        ReceptionDTO dto = new ReceptionDTO();
        dto.setId(reception.getId());
        dto.setReference(reception.getReference());
        dto.setDateReception(reception.getDateReception().toString());
        dto.setIdCommandeFournisseur(reception.getCommandeFournisseur().getId());
        dto.setReferenceCommande(reception.getCommandeFournisseur().getReference());
        dto.setFournisseur(reception.getCommandeFournisseur().getFournisseur().getNom() + " " + reception.getCommandeFournisseur().getFournisseur().getPrenom());
        dto.setIdBoutique(reception.getBoutique().getId());

        // Get lignesCommande
        List<LigneCommande> lignesCommande = ligneCommandeRepository.findByCommandeFournisseurId(reception.getCommandeFournisseur().getId());
        // Get lignesReception
        List<LigneReception> lignesReception = ligneReceptionService.findByReceptionId(reception.getId());

        List<ReceptionDTO.LigneReceptionDTO> lignesDTO = new ArrayList<>();
        for (LigneCommande lc : lignesCommande) {
            ReceptionDTO.LigneReceptionDTO ligneDTO = new ReceptionDTO.LigneReceptionDTO();
            ligneDTO.setIdProduit(lc.getStock().getProduit().getId());
            ligneDTO.setDesignation(lc.getStock().getProduit().getNomProduit());
            ligneDTO.setDepot(""); // Assuming no depot
            ligneDTO.setStock(0); // Assuming no stock
            ligneDTO.setQteCommande(lc.getQuantite());
            // Find qteRecue
            Integer qteRecue = lignesReception.stream()
                .filter(lr -> lr.getProduit().getId().equals(lc.getStock().getProduit().getId()))
                .mapToInt(LigneReception::getQuantiteRecu)
                .sum();
            ligneDTO.setQteRecue(qteRecue);
            ligneDTO.setReceptionActuelle(lc.getQuantite() - qteRecue);
            lignesDTO.add(ligneDTO);
        }
        dto.setLignesReception(lignesDTO);
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/commande/{commandeId}/articles")
    public ResponseEntity<Object> getArticlesForCommande(@PathVariable Long commandeId) {
        try {
            Optional<CommandeFournisseur> commandeOpt = commandeFournisseurService.findById(commandeId);
            if (!commandeOpt.isPresent()) {
                return ResponseEntity.notFound().build();
            }

            CommandeFournisseur commande = commandeOpt.get();
            List<ReceptionDTO.LigneReceptionDTO> articles = new ArrayList<>();

            for (LigneCommande ligne : commande.getLignes()) {
                Integer qteLivre = ligne.getQuantiteLivre() != null ? ligne.getQuantiteLivre() : 0;
                
                // Ne retourner que les articles qui ne sont pas complètement reçus
                if (ligne.getQuantite() > qteLivre) {
                    ReceptionDTO.LigneReceptionDTO dto = new ReceptionDTO.LigneReceptionDTO();
                    dto.setIdProduit(ligne.getStock().getProduit().getId());
                    dto.setDesignation(ligne.getStock().getProduit().getNomProduit());
                    dto.setDepot(ligne.getStock().getMagasin().getNom());
                    dto.setStock(ligne.getStock().getQuantiteDisponible());
                    dto.setQteCommande(ligne.getQuantite());
                    dto.setQteRecue(qteLivre);
                    // Quantité restante à recevoir = quantité commandée - quantité déjà reçue
                    dto.setReceptionActuelle(ligne.getQuantite() - qteLivre);
                    articles.add(dto);
                }
            }

            return ResponseEntity.ok(articles);
        } catch (Exception e) {
            logger.error("Erreur lors de la création de la réception: {}", e.getMessage(), e);
            java.util.Map<String, Object> err = new java.util.HashMap<>();
            err.put("error", "Erreur lors de la validation de la réception");
            err.put("details", e.getMessage());
            return ResponseEntity.status(500).body(err);
        }
    }

    @PostMapping("/create")
    @Transactional
    public ResponseEntity<Object> createReception(@RequestBody ReceptionDTO receptionDTO) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "RECEPTION_ECRITURE")) {
            return ResponseEntity.status(403).build(); // Forbidden
        }

        try {
            Optional<CommandeFournisseur> commandeOpt = commandeFournisseurService.findById(receptionDTO.getIdCommandeFournisseur());
            if (!commandeOpt.isPresent()) {
                return ResponseEntity.badRequest().build();
            }

            CommandeFournisseur commande = commandeOpt.get();
            if (!isSuperAdmin(user) && !commande.getBoutique().getId().equals(user.getBoutique().getId())) {
                return ResponseEntity.status(403).build();
            }

            Boutique boutique = user.getBoutique();
            Reception reception = new Reception();
            reception.setReference(receptionDTO.getReference());
            reception.setDateReception(LocalDateTime.now());
            reception.setCommandeFournisseur(commande);
            reception.setBoutique(boutique);

            Reception savedReception = receptionService.save(reception);

            List<LigneCommande> lignesCommande = ligneCommandeRepository.findByCommandeFournisseurId(commande.getId());
            Map<Long, LigneCommande> ligneParProduit = new HashMap<>();
            for (LigneCommande ligneCommande : lignesCommande) {
                if (ligneCommande.getStock() != null && ligneCommande.getStock().getProduit() != null) {
                    ligneParProduit.put(ligneCommande.getStock().getProduit().getId(), ligneCommande);
                }
            }

            // Validation des quantités avant traitement
            for (ReceptionDTO.LigneReceptionDTO ligneDTO : receptionDTO.getLignesReception()) {
                int receptionActuelle = ligneDTO.getReceptionActuelle() != null ? ligneDTO.getReceptionActuelle() : 0;
                if (receptionActuelle <= 0) continue;
                LigneCommande ligneCommande = ligneParProduit.get(ligneDTO.getIdProduit());
                if (ligneCommande == null) {
                    return ResponseEntity.badRequest().body(null);
                }
                Integer qteDejaRecue = ligneCommande.getQuantiteLivre() != null ? ligneCommande.getQuantiteLivre() : 0;
                Integer qteRestante = ligneCommande.getQuantite() - qteDejaRecue;
                if (receptionActuelle > qteRestante) {
                    return ResponseEntity.badRequest().body(null);
                }
            }

            for (ReceptionDTO.LigneReceptionDTO ligneDTO : receptionDTO.getLignesReception()) {
                int receptionActuelle = ligneDTO.getReceptionActuelle() != null ? ligneDTO.getReceptionActuelle() : 0;
                if (receptionActuelle <= 0) continue;
                LigneCommande ligneCommande = ligneParProduit.get(ligneDTO.getIdProduit());
                if (ligneCommande == null) continue;

                // Log before values
                Stock st = ligneCommande.getStock();
                logger.info("Reception: produitId={}, stockId={}, qtyBefore={}, costAverageBefore={}", ligneDTO.getIdProduit(), st != null ? st.getId() : null, st != null ? st.getQuantiteDisponible() : null, st != null ? st.getCostAverage() : null);

                Integer quantiteLivreActuelle = ligneCommande.getQuantiteLivre() != null ? ligneCommande.getQuantiteLivre() : 0;
                ligneCommande.setQuantiteLivre(quantiteLivreActuelle + receptionActuelle);
                LigneCommande savedLigne = ligneCommandeRepository.save(ligneCommande);

                updateStockCostAndPrices(savedLigne, receptionActuelle);

                // Log after values
                Stock stAfter = savedLigne.getStock();
                logger.info("Reception result: produitId={}, stockId={}, qtyAfter={}, costAverageAfter={}, lastPurchasePrice={}", ligneDTO.getIdProduit(), stAfter != null ? stAfter.getId() : null, stAfter != null ? stAfter.getQuantiteDisponible() : null, stAfter != null ? stAfter.getCostAverage() : null, stAfter != null ? stAfter.getLastPurchasePrice() : null);

                LigneReception ligneReception = new LigneReception();
                ligneReception.setReception(savedReception);
                ligneReception.setQuantiteRecu(receptionActuelle);
                if (savedLigne.getStock() != null && savedLigne.getStock().getProduit() != null) {
                    ligneReception.setProduit(savedLigne.getStock().getProduit());
                }
                ligneReceptionService.save(ligneReception);
            }

            receptionDTO.setId(savedReception.getId());
            receptionDTO.setDateReception(LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")));
            return ResponseEntity.ok(receptionDTO);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    private void updateStockCostAndPrices(LigneCommande ligneCommande, int receptionQty) {
        if (ligneCommande == null || receptionQty <= 0) return;
        Stock stock = ligneCommande.getStock();
        if (stock == null) return;

        // Convert reception quantity to real units according to product's conditionnement
        com.smboutique.api.model.Produit produit = stock.getProduit();
        int multiplicateur = (produit != null && produit.getNombreUnitesParConditionnement() != null && produit.getNombreUnitesParConditionnement() > 0)
                ? produit.getNombreUnitesParConditionnement()
                : 1;
        int quantiteReelle = receptionQty * multiplicateur;

        int currentQty = stock.getQuantiteDisponible() != null ? stock.getQuantiteDisponible() : 0;
        BigDecimal currentCostAverage = stock.getCostAverage() != null ? stock.getCostAverage() : BigDecimal.ZERO;

        // newPrice from ligneCommande is expected to be the supplier price per unit (base unit)
        BigDecimal incomingPrix = BigDecimal.valueOf(ligneCommande.getNewPrice() != null ? ligneCommande.getNewPrice() : 0);

        BigDecimal incomingQty = BigDecimal.valueOf(quantiteReelle);
        BigDecimal totalQty = BigDecimal.valueOf(currentQty).add(incomingQty);
        BigDecimal updatedCostAverage = BigDecimal.ZERO;
        if (totalQty.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal existingValue = currentCostAverage.multiply(BigDecimal.valueOf(currentQty));
            BigDecimal incomingValue = incomingPrix.multiply(incomingQty);
            updatedCostAverage = existingValue.add(incomingValue).divide(totalQty, 6, RoundingMode.HALF_UP);
        }

        // Persist stock updates
        stock.setCostAverage(updatedCostAverage);
        stock.setLastPurchasePrice(incomingPrix);
        stock.setQuantiteDisponible(currentQty + quantiteReelle);
        stockService.saveStock(stock);

        // Update product CMP and selling prices
        updateProductPricing(stock.getProduit(), updatedCostAverage, ligneCommande.getNewPrice(), stock);
    }

    private void updateProductPricing(Produit produit, BigDecimal costAverage, Integer supplierPrice, Stock stock) {
        if (produit == null || costAverage == null) return;

        // Update produit.prix_achat with CMP (rounded to integer)
        produit.setPrixAchat(costAverage.setScale(0, RoundingMode.HALF_UP).intValue());

        // Find margin config for boutique (prefer stock.magasin.boutique if available)
        Long boutiqueId = null;
        if (stock != null && stock.getMagasin() != null && stock.getMagasin().getBoutique() != null) {
            boutiqueId = stock.getMagasin().getBoutique().getId();
        }

        com.smboutique.api.model.ConfigurationMarge config = null;
        if (boutiqueId != null) {
            config = configurationMargeService.findByBoutiqueId(boutiqueId).orElse(null);
        }

        BigDecimal prixGrosBD;
        BigDecimal prixDetailBD;

        if (config == null) {
            // If no config, just keep prix en gros/detail equal to CMP
            prixGrosBD = costAverage;
            prixDetailBD = costAverage;
        } else {
            BigDecimal valGros = config.getValeurGros() != null ? config.getValeurGros() : BigDecimal.ZERO;
            BigDecimal valDetail = config.getValeurDetail() != null ? config.getValeurDetail() : BigDecimal.ZERO;
            if (config.getTypeMarge() == com.smboutique.api.model.ConfigurationMarge.TypeMarge.FIXE) {
                prixGrosBD = costAverage.add(valGros);
                prixDetailBD = costAverage.add(valDetail);
            } else {
                // POURCENTAGE
                prixGrosBD = costAverage.multiply(BigDecimal.ONE.add(valGros.divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP)));
                prixDetailBD = costAverage.multiply(BigDecimal.ONE.add(valDetail.divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP)));
            }
            // Enforce minimum fixed margins if configured
            BigDecimal minGros = config.getMargeMinimaleGros() != null ? config.getMargeMinimaleGros() : BigDecimal.ZERO;
            BigDecimal minDetail = config.getMargeMinimaleDetail() != null ? config.getMargeMinimaleDetail() : BigDecimal.ZERO;
            // actual margin = prix - CMP
            BigDecimal actualMarginGros = prixGrosBD.subtract(costAverage);
            BigDecimal actualMarginDetail = prixDetailBD.subtract(costAverage);
            boolean enforced = false;
            if (actualMarginGros.compareTo(minGros) < 0) {
                prixGrosBD = costAverage.add(minGros);
                enforced = true;
            }
            if (actualMarginDetail.compareTo(minDetail) < 0) {
                prixDetailBD = costAverage.add(minDetail);
                enforced = true;
            }
            if (enforced) {
                logger.info("Marge minimale appliquée pour produit {}: marge_gros_min={}, marge_detail_min={}", produit.getId(), minGros, minDetail);
            }
        }

        produit.setPrixEnGros(prixGrosBD.setScale(0, RoundingMode.HALF_UP).intValue());
        produit.setPrixDetail(prixDetailBD.setScale(0, RoundingMode.HALF_UP).intValue());

        produitService.save(produit);
    }

    private BigDecimal computePriceWithMargin(BigDecimal base, BigDecimal margePercent) {
        if (base == null) return null;
        BigDecimal percent = margePercent != null ? margePercent : BigDecimal.ZERO;
        BigDecimal factor = BigDecimal.ONE.add(percent.divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP));
        return base.multiply(factor);
    }
}
