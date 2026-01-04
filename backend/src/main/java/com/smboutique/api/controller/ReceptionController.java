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
    private com.smboutique.api.service.PdfService pdfService;

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
        // Only role membership determines superadmin status now
        return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
    }

    private boolean hasPermission(Utilisateur user, String permissionName) {
        // Delegate to service to include both direct and role-based permissions
        return utilisateurService.hasPermission(user, permissionName);
    }

    /**
     * Helper: accept multiple write-related permissions for receptions.
     * We historically used RECEPTION_ECRITURE in some places but the canonical
     * permission in the DB is RECEPTION_CREER / RECEPTION_MODIFIER.
     */
    private boolean canWriteReceptions(Utilisateur user) {
        if (user == null) return false;
        return utilisateurService.hasPermission(user, "RECEPTION_ECRITURE")
                || utilisateurService.hasPermission(user, "RECEPTION_CREER")
                || utilisateurService.hasPermission(user, "RECEPTION_MODIFIER");
    }

    @GetMapping
    public List<Reception> getAllReceptions() {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "RECEPTION_LECTURE") && !canWriteReceptions(user)) {
            return List.of(); // Return empty list if no permission (writers can also read)
        }
        if (isSuperAdmin(user)) {
            return receptionService.findAll();
        } else {
            return receptionService.findUnfinishedReceptionsByBoutiqueId(user.getBoutique().getId());
        }
    }

    @GetMapping("/status")
    public ResponseEntity<Object> getReceptionsStatus() {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "RECEPTION_LECTURE")) {
            return ResponseEntity.status(403).build();
        }
        try {
            java.util.List<com.smboutique.api.dto.ReceptionStatusDTO> list;
            if (isSuperAdmin(user)) {
                list = receptionService.getReceptionsStatusByBoutique(null);
            } else {
                list = receptionService.getReceptionsStatusByBoutique(user.getBoutique().getId());
            }
            return ResponseEntity.ok(list);
        } catch (Exception e) {
            logger.error("Error computing reception statuses: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/unfinished")
    public List<ReceptionListDTO> getUnfinishedReceptions() {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "RECEPTION_LECTURE") && !canWriteReceptions(user)) {
            return List.of(); // Return empty list if no permission (writers can also read)
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
        if (!hasPermission(user, "RECEPTION_LECTURE") && !canWriteReceptions(user)) {
            return List.of(); // Return empty list if no permission (writers can also read)
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
        if (!hasPermission(user, "RECEPTION_LECTURE") && !hasPermission(user, "RECEPTION_ECRITURE")) {
            return ResponseEntity.status(403).build(); // Forbidden (writers can also view)
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

    @GetMapping("/{id}/pdf")
    public void getReceptionPdf(@PathVariable Long id, jakarta.servlet.http.HttpServletResponse response) {
        Reception reception = receptionService.findById(id).orElse(null);
        if (reception == null) {
            try {
                response.sendError(404);
            } catch (Exception ignored) {}
            return;
        }
        try {
            pdfService.writeReceptionPdf(id, response);
        } catch (Exception e) {
            try { response.sendError(500); } catch (Exception ignored) {}
        }
    }

    @GetMapping("/commande/{commandeId}/last/pdf")
    public void getLastReceptionPdfByCommande(@PathVariable Long commandeId, jakarta.servlet.http.HttpServletResponse response) {
        logger.debug("Requesting last reception PDF for commandeId={}", commandeId);
        try {
            java.util.List<com.smboutique.api.model.Reception> recs = receptionService.findByCommandeFournisseurId(commandeId);
            logger.debug("Found {} receptions for commande {}", (recs == null ? 0 : recs.size()), commandeId);
            if (recs == null || recs.isEmpty()) {
                logger.warn("No receptions found for commande {} - returning 404", commandeId);
                response.sendError(404, "Aucune réception trouvée pour cette commande");
                return;
            }
            com.smboutique.api.model.Reception last = recs.stream().max(java.util.Comparator.comparing(com.smboutique.api.model.Reception::getDateReception)).orElse(recs.get(0));
            try {
                pdfService.writeReceptionPdf(last.getId(), response);
            } catch (Exception ex) {
                logger.error("Error while generating PDF for reception {}: {}", last.getId(), ex.getMessage(), ex);
                response.sendError(500, "Erreur génération PDF: " + (ex.getMessage() != null ? ex.getMessage() : "unknown"));
            }
        } catch (Exception e) {
            logger.error("Unexpected error fetching receptions for commande {}: {}", commandeId, e.getMessage(), e);
            try { response.sendError(500, "Erreur génération PDF"); } catch (Exception ignored) {}
        }
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
        if (!canWriteReceptions(user)) {
            logger.warn("Accès refusé à updateReception pour l'utilisateur {}: permissions manquantes (RECEPTION_CREER|RECEPTION_ECRITURE|RECEPTION_MODIFIER)", user.getEmail());
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
        if (!hasPermission(user, "RECEPTION_LECTURE") && !hasPermission(user, "RECEPTION_ECRITURE")) {
            return ResponseEntity.status(403).build(); // Forbidden (writers can also view)
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
        // Provide a user-friendly formatted date and an ISO_OFFSET field for technical use
        java.time.format.DateTimeFormatter displayFmt = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
        dto.setDateReception(reception.getDateReception() != null ? reception.getDateReception().format(displayFmt) : null);
        if (reception.getDateReception() != null) {
            dto.setDateReceptionIso(reception.getDateReception().atZone(java.time.ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        } else {
            dto.setDateReceptionIso(null);
        }
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
            // Defensive access: stock or produit may be null
            if (lc.getStock() != null && lc.getStock().getProduit() != null) {
                ligneDTO.setIdProduit(lc.getStock().getProduit().getId());
                ligneDTO.setDesignation(lc.getStock().getProduit().getNomProduit());
            } else {
                ligneDTO.setIdProduit(null);
                ligneDTO.setDesignation(lc.getDesignation() != null ? lc.getDesignation() : "Produit");
            }
            ligneDTO.setDepot(""); // Depot will be resolved client-side when needed
            ligneDTO.setStock(lc.getStock() != null && lc.getStock().getQuantiteDisponible() != null ? lc.getStock().getQuantiteDisponible() : 0);
            ligneDTO.setQteCommande(lc.getQuantite());
            // carry over quantiteConditionnement when present; also derive from units if divisible
            try { 
                Integer qCond = lc.getQuantiteConditionnement();
                Integer nombreUnites = null;
                String uniteLibelle = null;
                if (lc.getStock() != null && lc.getStock().getProduit() != null) {
                    nombreUnites = lc.getStock().getProduit().getNombreUnitesParConditionnement();
                    if (lc.getStock().getProduit().getUnite() != null) uniteLibelle = lc.getStock().getProduit().getUnite().getLibelle();
                    ligneDTO.setNombreUnitesParConditionnement(nombreUnites);
                    ligneDTO.setUniteConditionnementLibelle(uniteLibelle);
                }
                // If explicit conditionnement count is missing but qteCommande is divisible, derive it
                if (qCond == null && nombreUnites != null && nombreUnites > 1 && lc.getQuantite() != null && lc.getQuantite() % nombreUnites == 0) {
                    qCond = lc.getQuantite() / nombreUnites;
                }
                ligneDTO.setQuantiteConditionnement(qCond);
            } catch (Exception ex) { /* ignore */ }
            // Compute cumulative received up to and including this reception (sum over all receptions for the commande)
            int cumulativeRecue = 0;
            try {
                java.util.List<com.smboutique.api.model.Reception> allRecsForCommande = receptionService.findByCommandeFournisseurId(reception.getCommandeFournisseur().getId());
                if (allRecsForCommande != null) {
                    for (com.smboutique.api.model.Reception r : allRecsForCommande) {
                        if (r.getDateReception() == null || reception.getDateReception() == null) continue;
                        boolean beforeOrEqual = r.getDateReception().isBefore(reception.getDateReception()) || r.getDateReception().isEqual(reception.getDateReception());
                        if (!beforeOrEqual) continue;
                        java.util.List<com.smboutique.api.model.LigneReception> lrs = ligneReceptionService.findByReceptionId(r.getId());
                        int s = lrs.stream()
                                .filter(lr -> lr.getProduit() != null && lr.getProduit().getId() != null && lc.getStock() != null && lc.getStock().getProduit() != null && lr.getProduit().getId().equals(lc.getStock().getProduit().getId()))
                                .mapToInt(com.smboutique.api.model.LigneReception::getQuantiteRecu)
                                .sum();
                        cumulativeRecue += s;
                    }
                }
            } catch (Exception ex) { /* ignore */ }

            // qteRecue should be the quantity received IN THIS reception (units)
            Integer qteRecueThis = lignesReception.stream()
                .filter(lr -> lr.getProduit() != null && lc.getStock() != null && lc.getStock().getProduit() != null && lr.getProduit().getId().equals(lc.getStock().getProduit().getId()))
                .mapToInt(LigneReception::getQuantiteRecu)
                .sum();
            // conditionnement received this reception (if any)
            Integer qteCondRecueThis = lignesReception.stream()
                .filter(lr -> lr.getProduit() != null && lc.getStock() != null && lc.getStock().getProduit() != null && lr.getProduit().getId().equals(lc.getStock().getProduit().getId()))
                .mapToInt(lr -> lr.getQuantiteConditionnement() != null ? lr.getQuantiteConditionnement() : 0)
                .sum();

            ligneDTO.setQteRecue(qteRecueThis);
            // Remaining quantity after this reception (cumulative across receptions up to this one)
            ligneDTO.setReceptionActuelle(Math.max(lc.getQuantite() - cumulativeRecue, 0));

            // set conditionnement-specific received and remaining counts when divisible
            Integer nombreUnites = ligneDTO.getNombreUnitesParConditionnement();
            if (nombreUnites != null && nombreUnites > 1) {
                if (lc.getQuantite() % nombreUnites == 0) ligneDTO.setQuantiteConditionnement(lc.getQuantite() / nombreUnites);
                // if we have explicit cond counts from LigneReception use them; otherwise derive from unit counts when divisible
                if (qteCondRecueThis != null && qteCondRecueThis > 0) {
                    ligneDTO.setQuantiteConditionnementRecueThis(qteCondRecueThis);
                } else if (qteRecueThis != null && nombreUnites > 1 && qteRecueThis % nombreUnites == 0) {
                    ligneDTO.setQuantiteConditionnementRecueThis(qteRecueThis / nombreUnites);
                }
                if (Math.max(lc.getQuantite() - cumulativeRecue,0) % nombreUnites == 0) ligneDTO.setQuantiteConditionnementRestante(Math.max(lc.getQuantite() - cumulativeRecue,0) / nombreUnites);
            }
            lignesDTO.add(ligneDTO);
        }
        dto.setLignesReception(lignesDTO);
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/{id}/cancel")
    @Transactional
    public ResponseEntity<Object> cancelReception(@PathVariable Long id, @RequestBody(required = false) java.util.Map<String, String> body) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "RECEPTION_SUPPRESSION") && !hasPermission(user, "RECEPTION_ANNULATION")) {
            return ResponseEntity.status(403).build();
        }

        Optional<Reception> receptionOpt = receptionService.findById(id);
        if (receptionOpt.isEmpty()) return ResponseEntity.notFound().build();
        Reception reception = receptionOpt.get();
        if (reception.getAnnule() != null && reception.getAnnule()) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "Reception already cancelled"));
        }

        // Business rule: refuse cancel if there exists a later reception (not annulled) for the same commande that touches the same products
        java.util.List<Reception> recs = receptionService.findByCommandeFournisseurId(reception.getCommandeFournisseur().getId());
        java.util.List<LigneReception> lignes = ligneReceptionService.findByReceptionId(reception.getId());
        for (LigneReception lr : lignes) {
            Long produitId = lr.getProduit() != null ? lr.getProduit().getId() : null;
            if (produitId == null) continue;
            for (Reception r : recs) {
                if (r.getId().equals(reception.getId())) continue;
                if (r.getAnnule() != null && r.getAnnule()) continue;
                if (r.getDateReception() == null || reception.getDateReception() == null) continue;
                boolean later = r.getDateReception().isAfter(reception.getDateReception());
                if (!later) continue;
                java.util.List<LigneReception> otherLignes = ligneReceptionService.findByReceptionId(r.getId());
                for (LigneReception ol : otherLignes) {
                    if (ol.getProduit() != null && ol.getProduit().getId() != null && ol.getProduit().getId().equals(produitId) && (ol.getQuantiteRecu() != null && ol.getQuantiteRecu() > 0)) {
                        return ResponseEntity.badRequest().body(java.util.Map.of("error", "Impossible d'annuler la réception: une réception ultérieure existe pour le même produit"));
                    }
                }
            }
        }

        // Passed checks -> perform rollback using snapshots
        try {
            for (LigneReception lr : lignes) {
                if (lr.getProduit() == null) continue;
                // Restore stock values from snapshot where possible
                Long prodId = lr.getProduit().getId();
                // Find stock for product
                Stock stock = null;
                try {
                    java.util.List<Stock> stocks = stockService.getStocksByProduit(prodId);
                    stock = (stocks != null && !stocks.isEmpty()) ? stocks.get(0) : null;
                } catch (Exception ex) {
                    stock = null;
                }
                if (stock != null) {
                    if (lr.getBeforeStockQuantite() != null) stock.setQuantiteDisponible(lr.getBeforeStockQuantite());
                    if (lr.getBeforeStockCostAverage() != null) stock.setCostAverage(lr.getBeforeStockCostAverage());
                    if (lr.getBeforeProduitPrixAchat() != null && stock.getProduit() != null) stock.getProduit().setPrixAchat(lr.getBeforeProduitPrixAchat());
                    stockService.saveStock(stock);
                }

                // Decrement ligneCommande.quantiteLivre accordingly (if the product exists on the commande)
                LigneCommande lc = ligneCommandeRepository.findByCommandeFournisseurId(reception.getCommandeFournisseur().getId())
                        .stream().filter(x -> x.getStock() != null && x.getStock().getProduit() != null && x.getStock().getProduit().getId().equals(prodId)).findFirst().orElse(null);
                if (lc != null) {
                    int currentLivre = lc.getQuantiteLivre() != null ? lc.getQuantiteLivre() : 0;
                    lc.setQuantiteLivre(Math.max(0, currentLivre - (lr.getQuantiteRecu() != null ? lr.getQuantiteRecu() : 0)));
                    ligneCommandeRepository.save(lc);
                }
            }

            reception.setAnnule(true);
            reception.setAnnuleAt(java.time.LocalDateTime.now());
            reception.setAnnulePar(user.getId());
            reception.setAnnuleReason(body != null ? body.getOrDefault("reason", null) : null);
            receptionService.save(reception);

            return ResponseEntity.ok(java.util.Map.of("id", reception.getId(), "annule", true));
        } catch (Exception ex) {
            logger.error("Error canceling reception {}: {}", reception.getId(), ex.getMessage(), ex);
            return ResponseEntity.status(500).body(java.util.Map.of("error", "Internal server error"));
        }
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
                    // Defensive: stock or produit may be null in some legacy records
                    Stock s = ligne.getStock();
                    if (s != null && s.getProduit() != null) {
                        dto.setIdProduit(s.getProduit().getId());
                        dto.setDesignation(s.getProduit().getNomProduit());
                    } else {
                        // fallback to ligne.designation if present, else null
                        dto.setIdProduit(null);
                        dto.setDesignation(ligne.getDesignation() != null ? ligne.getDesignation() : "Produit");
                    }

                    // Depot: prefer magasin name when present, else boutique name, else empty
                    String depotName = "";
                    if (s != null) {
                        if (s.getMagasin() != null && s.getMagasin().getNom() != null) depotName = s.getMagasin().getNom();
                        else if (s.getBoutique() != null && s.getBoutique().getNom() != null) depotName = s.getBoutique().getNom();
                    }
                    dto.setDepot(depotName);

                    dto.setStock(s != null && s.getQuantiteDisponible() != null ? s.getQuantiteDisponible() : 0);
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
        logger.info("createReception called; authentication name={}", org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication() == null ? "null" : org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName());
        try {
            java.util.Collection<?> auths = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication() == null ? java.util.List.of() : org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getAuthorities();
            logger.info("Authentication authorities: {}", auths);
        } catch (Exception e) {
            logger.warn("Unable to log authentication authorities: {}", e.getMessage());
        }
        Utilisateur user = getCurrentUser();
        // Debug log: dump permission names seen on the current user to help diagnose 403 issues
        try {
            if (user != null && user.getPermissions() != null) {
                logger.debug("Permissions for user {}: {}", user.getEmail(), user.getPermissions().stream().map(p -> p.getName()).sorted().toList());
            } else {
                logger.debug("User or permissions null for user: {}", user == null ? "null" : user.getEmail());
            }
        } catch (Exception ex) {
            logger.warn("Erreur lors du dump des permissions utilisateur {}: {}", user == null ? "null" : user.getEmail(), ex.getMessage());
        }

        if (!canWriteReceptions(user)) {
            logger.warn("Accès refusé à createReception pour l'utilisateur {}: permissions manquantes (RECEPTION_CREER|RECEPTION_ECRITURE|RECEPTION_MODIFIER)", user.getEmail());
            return ResponseEntity.status(403).build(); // Forbidden
        }

        try {
            Optional<CommandeFournisseur> commandeOpt = commandeFournisseurService.findById(receptionDTO.getIdCommandeFournisseur());
            if (!commandeOpt.isPresent()) {
                return ResponseEntity.badRequest().build();
            }

            CommandeFournisseur commande = commandeOpt.get();
            if (!isSuperAdmin(user) && !commande.getBoutique().getId().equals(user.getBoutique().getId())) {
                logger.warn("Accès refusé : commande.boutique.id={} ne correspond pas à user.boutique.id={} pour utilisateur={} (isSuperAdmin={})",
                        commande.getBoutique().getId(), user.getBoutique() == null ? null : user.getBoutique().getId(), user.getEmail(), isSuperAdmin(user));
                return ResponseEntity.status(403).build();
            }

            Boutique boutique = user.getBoutique();
            Reception reception = new Reception();
            reception.setReference(receptionDTO.getReference());
            // Use client-provided dateReception if present (parse ISO or fallback to dd/MM/yyyy HH:mm:ss), otherwise use server now
            if (receptionDTO.getDateReception() != null && !receptionDTO.getDateReception().isBlank()) {
                try {
                    String dr = receptionDTO.getDateReception();
                    // Try parsing as ISO instant (with Z or offset)
                    if (dr.contains("T") && (dr.endsWith("Z") || dr.matches(".*[+-]\\d{2}:?\\d{2}$"))) {
                        java.time.Instant inst = java.time.Instant.parse(dr);
                        if (receptionDTO.getTimezoneOffsetMinutes() != null) {
                            // Convert instant to local time using client's timezone offset
                            int off = receptionDTO.getTimezoneOffsetMinutes();
                            java.time.ZoneOffset zo = java.time.ZoneOffset.ofTotalSeconds(-off * 60);
                            reception.setDateReception(LocalDateTime.ofInstant(inst, zo));
                        } else {
                            // Fallback: place instant in server default zone (previous behavior)
                            reception.setDateReception(LocalDateTime.ofInstant(inst, java.time.ZoneId.systemDefault()));
                        }
                    } else {
                        // Fallback: try dd/MM/yyyy HH:mm:ss
                        java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
                        reception.setDateReception(LocalDateTime.parse(dr, fmt));
                    }
                } catch (Exception ex) {
                    // If parsing fails, fallback to server time
                    reception.setDateReception(LocalDateTime.now());
                }
            } else {
                reception.setDateReception(LocalDateTime.now());
            }
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
            // Also check for invalid stocks: forbid stock with quantite_disponible > 0 and cost_average IS NULL
            List<String> stockErrors = new ArrayList<>();
            for (LigneCommande lc : ligneParProduit.values()) {
                Stock s = lc.getStock();
                if (s != null && s.getQuantiteDisponible() != null && s.getQuantiteDisponible() > 0 && s.getCostAverage() == null) {
                    stockErrors.add("Stock id " + s.getId() + " has quantite_disponible>0 but cost_average IS NULL");
                }
            }
            if (!stockErrors.isEmpty()) {
                Map<String, Object> err = new HashMap<>();
                err.put("error", "Invalid stock state");
                err.put("details", stockErrors);
                return ResponseEntity.badRequest().body(err);
            }

            for (ReceptionDTO.LigneReceptionDTO ligneDTO : receptionDTO.getLignesReception()) {
                int receptionActuelle = ligneDTO.getReceptionActuelle() != null ? ligneDTO.getReceptionActuelle() : 0;
                if (receptionActuelle <= 0) continue;
                LigneCommande ligneCommande = ligneParProduit.get(ligneDTO.getIdProduit());
                if (ligneCommande == null) {
                    Map<String, Object> err = new HashMap<>();
                    err.put("error", "Produit non trouvé sur la commande");
                    err.put("produitId", ligneDTO.getIdProduit());
                    return ResponseEntity.badRequest().body(err);
                }
                Integer qteDejaRecue = ligneCommande.getQuantiteLivre() != null ? ligneCommande.getQuantiteLivre() : 0;
                Integer qteRestante = ligneCommande.getQuantite() - qteDejaRecue;
                if (receptionActuelle > qteRestante) {
                    Map<String, Object> err = new HashMap<>();
                    err.put("error", "Quantité à recevoir supérieure à la quantité restante");
                    err.put("produitId", ligneDTO.getIdProduit());
                    err.put("receptionDemandee", receptionActuelle);
                    err.put("qteRestante", qteRestante);
                    return ResponseEntity.badRequest().body(err);
                }
            }

            List<ReceptionDTO.LigneReceptionResultDTO> results = new ArrayList<>();

            for (ReceptionDTO.LigneReceptionDTO ligneDTO : receptionDTO.getLignesReception()) {
                int receptionActuelle = ligneDTO.getReceptionActuelle() != null ? ligneDTO.getReceptionActuelle() : 0;
                if (receptionActuelle <= 0) continue;
                LigneCommande ligneCommande = ligneParProduit.get(ligneDTO.getIdProduit());
                if (ligneCommande == null) continue;

                // Log before values
                Stock st = ligneCommande.getStock();
                Integer ancienStock = st != null ? st.getQuantiteDisponible() : null;
                java.math.BigDecimal ancienCMP = st != null ? st.getCostAverage() : null;
                logger.info("Reception: produitId={}, stockId={}, ancienStock={}, ancienCMP={}, quantiteRecue={} , prixFournisseur={} ", ligneDTO.getIdProduit(), st != null ? st.getId() : null, ancienStock, ancienCMP, receptionActuelle, ligneCommande.getNewPrice());

                Integer quantiteLivreActuelle = ligneCommande.getQuantiteLivre() != null ? ligneCommande.getQuantiteLivre() : 0;
                ligneCommande.setQuantiteLivre(quantiteLivreActuelle + receptionActuelle);
                LigneCommande savedLigne = ligneCommandeRepository.save(ligneCommande);

                // Update stock and product; updateStockCostAndPrices now returns the updated CMP
                java.math.BigDecimal updatedCMP = updateStockCostAndPrices(savedLigne, receptionActuelle);

                // Log after values
                Stock stAfter = savedLigne.getStock();
                logger.info("Reception result: produitId={}, stockId={}, qtyAfter={}, costAverageAfter={}, lastPurchasePrice={}", ligneDTO.getIdProduit(), stAfter != null ? stAfter.getId() : null, stAfter != null ? stAfter.getQuantiteDisponible() : null, stAfter != null ? stAfter.getCostAverage() : null, stAfter != null ? stAfter.getLastPurchasePrice() : null);

                // Build result DTO
                ReceptionDTO.LigneReceptionResultDTO result = new ReceptionDTO.LigneReceptionResultDTO();
                result.setIdProduit(ligneDTO.getIdProduit());
                result.setIdStock(stAfter != null ? stAfter.getId() : null);
                result.setAncienStock(ancienStock);
                result.setAncienCMP(ancienCMP);
                result.setQuantiteRecue(receptionActuelle);
                result.setPrixFournisseur(java.math.BigDecimal.valueOf(ligneCommande.getNewPrice() != null ? ligneCommande.getNewPrice() : 0));
                result.setNouveauCMP(updatedCMP);
                if (stAfter != null && stAfter.getProduit() != null) {
                    result.setProduitPrixAchat(stAfter.getProduit().getPrixAchat());
                }
                results.add(result);

                LigneReception ligneReception = new LigneReception();
                ligneReception.setReception(savedReception);
                ligneReception.setQuantiteRecu(receptionActuelle);
                if (savedLigne.getStock() != null && savedLigne.getStock().getProduit() != null) {
                    ligneReception.setProduit(savedLigne.getStock().getProduit());
                }

                // Save snapshot of stock/product state BEFORE the update (to allow safe rollback)
                ligneReception.setBeforeStockQuantite(ancienStock);
                ligneReception.setBeforeStockCostAverage(ancienCMP);
                try {
                    if (st != null && st.getProduit() != null) {
                        ligneReception.setBeforeProduitPrixAchat(st.getProduit().getPrixAchat());
                    }
                } catch (Exception ex) {
                    // ignore if not available
                }

                ligneReceptionService.save(ligneReception);
            }

            receptionDTO.setId(savedReception.getId());
            // return the saved reception's timestamp in a consistent format
            receptionDTO.setDateReception(savedReception.getDateReception() != null ? savedReception.getDateReception().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")) : LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")));
            receptionDTO.setLignesResult(results);
            return ResponseEntity.ok(receptionDTO);
        } catch (RuntimeException e) {
            logger.error("Validation error during reception: {}", e.getMessage());
            Map<String, Object> err = new HashMap<>();
            err.put("error", "Validation error");
            err.put("details", e.getMessage());
            return ResponseEntity.badRequest().body(err);
        } catch (Exception e) {
            logger.error("Unexpected error during reception: {}", e.getMessage(), e);
            Map<String, Object> err = new HashMap<>();
            err.put("error", "Unexpected error during reception");
            err.put("details", e.getMessage());
            return ResponseEntity.status(500).body(err);
        }
    }

    private java.math.BigDecimal updateStockCostAndPrices(LigneCommande ligneCommande, int receptionQty) {
        if (ligneCommande == null || receptionQty <= 0) return java.math.BigDecimal.ZERO;
        Stock stock = ligneCommande.getStock();
        if (stock == null) return java.math.BigDecimal.ZERO;

        // receptionQty is expected to be expressed in UNITS (base units). Older code multiplied by multiplicateur
        // (conditionnement) which caused double multiplication when front-end already provided unit counts.
        // Therefore we treat receptionQty as units and use it directly as quantiteReelle.
        com.smboutique.api.model.Produit produit = stock.getProduit();
        int multiplicateur = (produit != null && produit.getNombreUnitesParConditionnement() != null && produit.getNombreUnitesParConditionnement() > 0)
                ? produit.getNombreUnitesParConditionnement()
                : 1;
        int quantiteReelle = receptionQty; // already units

        int currentQty = stock.getQuantiteDisponible() != null ? stock.getQuantiteDisponible() : 0;
        java.math.BigDecimal currentCostAverage = stock.getCostAverage() != null ? stock.getCostAverage() : java.math.BigDecimal.ZERO;

        // newPrice from ligneCommande is expected to be the supplier price per unit (base unit)
        java.math.BigDecimal incomingPrix = java.math.BigDecimal.valueOf(ligneCommande.getNewPrice() != null ? ligneCommande.getNewPrice() : 0);

        java.math.BigDecimal incomingQty = java.math.BigDecimal.valueOf(quantiteReelle);
        java.math.BigDecimal totalQty = java.math.BigDecimal.valueOf(currentQty).add(incomingQty);
        java.math.BigDecimal updatedCostAverage = java.math.BigDecimal.ZERO;
        if (totalQty.compareTo(java.math.BigDecimal.ZERO) > 0) {
            java.math.BigDecimal existingValue = currentCostAverage.multiply(java.math.BigDecimal.valueOf(currentQty));
            java.math.BigDecimal incomingValue = incomingPrix.multiply(incomingQty);
            updatedCostAverage = existingValue.add(incomingValue).divide(totalQty, 6, java.math.RoundingMode.HALF_UP);
        }

        // Consistency check: updated CMP must be between ancien CMP and supplier price
        java.math.BigDecimal min = currentCostAverage.min(incomingPrix);
        java.math.BigDecimal max = currentCostAverage.max(incomingPrix);
        if (updatedCostAverage.compareTo(min) < 0 || updatedCostAverage.compareTo(max) > 0) {
            throw new RuntimeException("CMP incohérent calculé: " + updatedCostAverage + " (ancien: " + currentCostAverage + ", fournisseur: " + incomingPrix + ")");
        }

        // Persist stock updates
        stock.setCostAverage(updatedCostAverage);
        stock.setLastPurchasePrice(incomingPrix);
        stock.setQuantiteDisponible(currentQty + quantiteReelle);
        stockService.saveStock(stock);

        // Update product CMP and selling prices (and margins)
        updateProductPricing(stock.getProduit(), updatedCostAverage, ligneCommande.getNewPrice(), stock);

        // Validate produit.prix_achat equals stock.cost_average rounded
        if (stock.getProduit() != null) {
            Integer produitPrixAchat = stock.getProduit().getPrixAchat();
            Integer rounded = updatedCostAverage.setScale(0, java.math.RoundingMode.HALF_UP).intValue();
            if (produitPrixAchat == null || !produitPrixAchat.equals(rounded)) {
                throw new RuntimeException("Mismatch produit.prix_achat (" + produitPrixAchat + ") != rounded stock.cost_average (" + rounded + ") for produit " + stock.getProduit().getId());
            }
        }

        return updatedCostAverage;
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

        // Recalculate and store margin fields (marge_gros and marge_detail)
        java.math.BigDecimal margeGrosValue = prixGrosBD.subtract(costAverage);
        java.math.BigDecimal margeDetailValue = prixDetailBD.subtract(costAverage);
        produit.setMargeGros(margeGrosValue);
        produit.setMargeDetail(margeDetailValue);

        produitService.save(produit);
    }

    private BigDecimal computePriceWithMargin(BigDecimal base, BigDecimal margePercent) {
        if (base == null) return null;
        BigDecimal percent = margePercent != null ? margePercent : BigDecimal.ZERO;
        BigDecimal factor = BigDecimal.ONE.add(percent.divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP));
        return base.multiply(factor);
    }
}
