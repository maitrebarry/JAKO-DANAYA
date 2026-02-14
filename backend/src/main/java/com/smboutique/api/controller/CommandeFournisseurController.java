package com.smboutique.api.controller;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.CommandeFournisseur;
import com.smboutique.api.model.Fournisseur;
import com.smboutique.api.model.Stock;
import com.smboutique.api.model.Reception;
import com.smboutique.api.model.LigneReception;
import com.smboutique.api.model.Mouvement;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.LigneCommandeRepository;
import com.smboutique.api.model.Paiement;
import com.smboutique.api.service.PaiementService;
import java.time.LocalDateTime;
import com.smboutique.api.dto.CommandeFournisseurDTO;
import com.smboutique.api.service.CommandeFournisseurService;
import com.smboutique.api.service.PdfService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/api/commandes-fournisseurs")
@CrossOrigin(origins = "*")
public class CommandeFournisseurController {

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(CommandeFournisseurController.class);

    @Autowired
    private CommandeFournisseurService commandeFournisseurService;

    @Autowired
    private LigneCommandeRepository ligneCommandeRepository;

    @Autowired
    private com.smboutique.api.repository.CommandeFournisseurRepository commandeFournisseurRepository;

    @Autowired
    private com.smboutique.api.repository.StockRepository stockRepository;

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private PaiementService paiementService;

    @Autowired
    private com.smboutique.api.service.ReceptionService receptionService;

    @Autowired
    private com.smboutique.api.service.LigneReceptionService ligneReceptionService;

    @Autowired
    private com.smboutique.api.service.MouvementService mouvementService;

    @Autowired
    private com.smboutique.api.repository.CaisseRepository caisseRepository;

    @Autowired
    private com.smboutique.api.repository.ReceptionRepository receptionRepository;

    @Autowired
    private PdfService pdfService;

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

    @GetMapping
    public List<CommandeFournisseurDTO> getAllCommandeFournisseurs() {
        Utilisateur current = getCurrentUser();
        List<CommandeFournisseur> commandes;

        if (isSuperAdmin(current)) {
            commandes = commandeFournisseurService.findAll();
        } else {
            if (current.getBoutique() == null) {
                return List.of();
            }
            commandes = commandeFournisseurService.findAllByBoutiqueId(current.getBoutique().getId());
        }

        return commandes.stream().map(this::convertToDTO).collect(java.util.stream.Collectors.toList());
    }

    @GetMapping("/a-recevoir")
    public List<CommandeFournisseurDTO> getCommandesARecevoir() {
        Utilisateur current = getCurrentUser();
        List<CommandeFournisseur> commandes;

        if (isSuperAdmin(current)) {
            commandes = commandeFournisseurService.findAll();
        } else {
            if (current.getBoutique() == null) {
                return List.of();
            }
            commandes = commandeFournisseurService.findAllByBoutiqueId(current.getBoutique().getId());
        }

        List<CommandeFournisseur> commandesFiltrees = commandes.stream()
                .filter(this::hasItemsToReceive)
                .collect(java.util.stream.Collectors.toList());

        return commandesFiltrees.stream().map(this::convertToDTO).collect(java.util.stream.Collectors.toList());
    }

    @GetMapping("/boutique/{boutiqueId}")
    public List<CommandeFournisseurDTO> getAllCommandeFournisseursByBoutique(@PathVariable Long boutiqueId) {
        Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && (current.getBoutique() == null || !current.getBoutique().getId().equals(boutiqueId))) {
            return List.of();
        }
        // Return all commandes for the boutique (including fully-paid). Filtering for unpaid commandes
        // is handled by the /boutique/{boutiqueId}/a-payer endpoint (used by the payment UI select).
        List<CommandeFournisseur> commandes = commandeFournisseurService.findAllByBoutiqueId(boutiqueId);
        return commandes.stream().map(this::convertToDTO).collect(java.util.stream.Collectors.toList());
    }

    @GetMapping("/boutique/{boutiqueId}/a-payer")
    public List<CommandeFournisseurDTO> getAllCommandeFournisseursNonPayeesByBoutique(@PathVariable Long boutiqueId) {
        Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && (current.getBoutique() == null || !current.getBoutique().getId().equals(boutiqueId))) {
            return List.of();
        }
        List<CommandeFournisseur> commandes = commandeFournisseurService.findAllByBoutiqueId(boutiqueId);
        List<CommandeFournisseur> nonPayees = commandes.stream()
                .filter(cmd -> {
                    Integer paie = cmd.getPaie() != null ? cmd.getPaie() : 0;
                    Integer total = cmd.getTotal() != null ? cmd.getTotal() : 0;
                    return paie < total;
                })
                .collect(java.util.stream.Collectors.toList());
        return nonPayees.stream().map(this::convertToDTO).collect(java.util.stream.Collectors.toList());
    }

    // Return commandes that still have items to receive (non-receptionnees)
    @GetMapping("/boutique/{boutiqueId}/a-recevoir")
    public List<CommandeFournisseurDTO> getCommandesNonReceptionneesByBoutique(@PathVariable Long boutiqueId) {
        Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && (current.getBoutique() == null || !current.getBoutique().getId().equals(boutiqueId))) {
            return List.of();
        }
        java.util.List<CommandeFournisseur> commandes = commandeFournisseurRepository.findNonReceptionneesByBoutiqueId(boutiqueId);
        return commandes.stream().map(this::convertToDTO).collect(java.util.stream.Collectors.toList());
    }

    // Return commandes that are fully receptionnees (have receptions and no pending lines)
    @GetMapping("/boutique/{boutiqueId}/receptionnees")
    public List<CommandeFournisseurDTO> getCommandesTotalementReceptionneesByBoutique(@PathVariable Long boutiqueId) {
        Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && (current.getBoutique() == null || !current.getBoutique().getId().equals(boutiqueId))) {
            return List.of();
        }
        java.util.List<CommandeFournisseur> commandes = commandeFournisseurRepository.findCommandesTotalementReceptionneesByBoutiqueId(boutiqueId);
        return commandes.stream().map(this::convertToDTO).collect(java.util.stream.Collectors.toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<com.smboutique.api.dto.CommandeFournisseurDTO> getCommandeFournisseurById(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        if (isSuperAdmin(current)) {
            return commandeFournisseurService.findById(id)
                    .map(this::convertToDTO)
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        }
        if (current.getBoutique() == null) {
            return ResponseEntity.status(403).build();
        }
        return commandeFournisseurService.findByIdAndBoutiqueId(id, current.getBoutique().getId())
                .map(this::convertToDTO)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/pdf")
    public void getCommandePdf(@PathVariable Long id, jakarta.servlet.http.HttpServletResponse response) {
        logger.info("getCommandePdf called for id={}", id);
        // Diagnostic log: record principal and authentication presence
        try {
            java.security.Principal principal = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (principal != null) {
                String name = principal.getName();
                org.slf4j.LoggerFactory.getLogger(CommandeFournisseurController.class).info("getCommandePdf called for id={} by user={}", id, name);
            } else {
                org.slf4j.LoggerFactory.getLogger(CommandeFournisseurController.class).info("getCommandePdf called for id={} by anonymous user", id);
            }
        } catch (Exception ex) {
            // ignore diagnostic logging failures
        }
        try {
            pdfService.writeCommandePdf(id, response);
            try {
                Long userId = null;
                try {
                    var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                    if (auth != null && auth.getName() != null) {
                        var u = utilisateurService.findByEmail(auth.getName()).orElse(null);
                        if (u != null) userId = u.getId();
                    }
                } catch (Exception ignore) {}
                var copt = commandeFournisseurService.findById(id);
                if (copt.isPresent()) {
                    var c = copt.get();
                    Long boutiqueId = c.getBoutique() != null ? c.getBoutique().getId() : null;
                    Double montant = c.getTotal() != null ? Double.valueOf(c.getTotal()) : null;
                    mouvementService.log("DOCUMENT", "COMMANDE_FOURNISSEUR_PDF", "Génération PDF - COMMANDE FOURNISSEUR", id, boutiqueId, null, userId, montant);
                }
            } catch (Exception ignore) {}
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(CommandeFournisseurController.class)
                    .error("getCommandePdf error for id={}: {}", id, e.getMessage(), e);
            try {
                if (!response.isCommitted()) {
                    response.resetBuffer();
                    response.setStatus(500);
                    response.setContentType("application/json");
                    String msg = e.getMessage() != null ? e.getMessage() : "Erreur inconnue";
                    String body = "{\"error\":\"Erreur génération PDF commande fournisseur\",\"message\":\"" + msg.replace("\"", "\\\"") + "\"}";
                    response.getWriter().write(body);
                    response.getWriter().flush();
                }
            } catch (java.io.IOException ioEx) {
                // ignore
            }
        }
    }

    @PostMapping
    public ResponseEntity<CommandeFournisseur> createCommandeFournisseur(@RequestBody CommandeFournisseurRequest request) {
        // Permission check: COMMANDE_CREER required
        Utilisateur currentUser = getCurrentUser();
        if (!isSuperAdmin(currentUser) && !utilisateurService.hasPermission(currentUser, "COMMANDE_CREER")) {
            return ResponseEntity.status(403).build();
        }

        Boutique boutique = currentUser.getBoutique();
        if (boutique == null) throw new IllegalArgumentException("Boutique non trouvée pour l'utilisateur");

        CommandeFournisseur commande = new CommandeFournisseur();
        commande.setReference(request.getReference());
        // Parse date with proper formatter for 'yyyy-MM-dd HH:mm' format
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
        commande.setDateCommande(java.time.LocalDateTime.parse(request.getDateCommande().replace('T', ' '), formatter));
        commande.setTotal((int) request.getTotal());
        commande.setUtilisateur(currentUser);
        commande.setBoutique(boutique);

        // Set fournisseur
        Fournisseur fournisseur = new Fournisseur();
        fournisseur.setId(request.getFournisseur().getId());
        commande.setFournisseur(fournisseur);

        try {
            // Create lignes
            List<com.smboutique.api.model.LigneCommande> lignes = new java.util.ArrayList<>();
            if (request.getProduitsSelectionnes() != null) {
                for (CommandeFournisseurRequest.ProduitSelectionne ps : request.getProduitsSelectionnes()) {
                    if (ps == null || ps.getId_stock() == null) continue;

                    com.smboutique.api.model.LigneCommande ligne = new com.smboutique.api.model.LigneCommande();
                    Stock stock = new Stock();
                    stock.setId(ps.getId_stock());
                    ligne.setStock(stock);

                    // compute effective quantity in UNITS. Prefer quantiteConditionnement when provided.
                    int effectiveQty = ps.getQuantite();
                    if (ps.getQuantiteConditionnement() != null) {
                        if (ps.getQuantiteConditionnement() < 0) throw new IllegalArgumentException("Quantité invalide");
                        int mul = 1;
                        java.util.Optional<Stock> sOpt = stockRepository.findById(ps.getId_stock());
                        if (sOpt.isPresent() && sOpt.get().getProduit() != null && sOpt.get().getProduit().getNombreUnitesParConditionnement() != null) {
                            mul = sOpt.get().getProduit().getNombreUnitesParConditionnement();
                        }
                        effectiveQty = ps.getQuantiteConditionnement() * mul;
                    }

                    ligne.setQuantite(effectiveQty);
                    ligne.setQuantiteConditionnement(ps.getQuantiteConditionnement());
                    ligne.setNewPrice((int) ps.getPrix());
                    ligne.setCommandeFournisseur(commande);
                    lignes.add(ligne);
                }
            }
            commande.setLignes(lignes);

            CommandeFournisseur saved = commandeFournisseurService.save(commande);
            try { mouvementService.log("COMMANDE", "CREATION", "Commande fournisseur créée", saved.getId(), saved.getBoutique() != null ? saved.getBoutique().getId() : null, null, currentUser != null ? currentUser.getId() : null, saved.getTotal() != null ? Double.valueOf(saved.getTotal()) : null); } catch (Exception e) {}
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.BAD_REQUEST).body((CommandeFournisseur) null);
        }
    }
    @PostMapping("/{id}/paiement")
    public ResponseEntity<CommandeFournisseur> enregistrerPaiement(@PathVariable Long id, @RequestBody PaiementRequest request) {
        Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && (current.getBoutique() == null)) {
            return ResponseEntity.status(403).build();
        }
        // Permission: creating payments for a commande
        if (!isSuperAdmin(current) && !utilisateurService.hasPermission(current, "PAIEMENT_CREER")) {
            return ResponseEntity.status(403).build();
        }

        Long boutiqueId = isSuperAdmin(current) ? (current.getBoutique() != null ? current.getBoutique().getId() : null) : current.getBoutique().getId();
        if (boutiqueId == null) {
            return ResponseEntity.status(403).build();
        }

        java.util.Optional<CommandeFournisseur> cmdOpt = commandeFournisseurService.findByIdAndBoutiqueId(id, boutiqueId);
        if (!cmdOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        CommandeFournisseur cmd = cmdOpt.get();
        int montant = request.getMontant() != null ? request.getMontant() : 0;
        Integer paieExistante = cmd.getPaie() != null ? cmd.getPaie() : 0;
        Integer totalCommande = cmd.getTotal() != null ? cmd.getTotal() : 0;
        if (montant <= 0) {
            return ResponseEntity.badRequest().build();
        }
        if (paieExistante + montant > totalCommande) {
            return ResponseEntity.badRequest().build();
        }
        // Persist a Paiement record for historization
        try {
            Paiement paiement = new Paiement();
            paiement.setMontantPaye(montant);
            // compute client's local time similarly to client payments
            java.time.LocalDateTime clientLocalDateTime = null;
            if (request.getDate() != null && !request.getDate().trim().isEmpty()) {
                try {
                    String dr = request.getDate();
                    java.time.Instant inst;
                    try {
                        inst = java.time.Instant.parse(dr);
                    } catch (Exception e) {
                        inst = java.time.OffsetDateTime.parse(dr).toInstant();
                    }
                    if (request.getTimezoneOffsetMinutes() != null) {
                        int off = request.getTimezoneOffsetMinutes();
                        java.time.ZoneOffset zo = java.time.ZoneOffset.ofTotalSeconds(-off * 60);
                        clientLocalDateTime = LocalDateTime.ofInstant(inst, zo);
                    } else {
                        clientLocalDateTime = LocalDateTime.ofInstant(inst, java.time.ZoneId.systemDefault());
                    }
                } catch (Exception ex) {
                    try {
                        java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
                        clientLocalDateTime = LocalDateTime.parse(request.getDate(), fmt);
                    } catch (Exception ex2) {
                        clientLocalDateTime = LocalDateTime.now();
                    }
                }
            } else {
                clientLocalDateTime = LocalDateTime.now();
            }
            paiement.setDatePaie(clientLocalDateTime);
            paiement.setReference(request.getReference());
            // Supplier payments do NOT involve caisse; persist paiement only
            paiement.setCommandeFournisseur(cmd);
            paiementService.save(paiement);

            try {
                mouvementService.log("PAIEMENT", "COMMANDE_FOURNISSEUR", "Paiement reçu pour commande fournisseur", cmd.getId(), cmd.getBoutique() != null ? cmd.getBoutique().getId() : null, null, current != null ? current.getId() : null, Double.valueOf(montant));
            } catch (Exception e) { /* ignore */ }

            boolean caisseUpdated = false;
            Integer caisseNewTotal = null;
            try {
                cmd.setPaie(paieExistante + montant);
                CommandeFournisseur updated = commandeFournisseurService.save(cmd);
                if (caisseUpdated) {
                    return ResponseEntity.ok().header("X-Caisse-Updated", "true").header("X-Caisse-Total", String.valueOf(caisseNewTotal)).body(updated);
                }
                return ResponseEntity.ok(updated);
            } catch (Exception ex) {
                System.out.println("Warning: unable to persist paiement record: " + ex.getMessage());
                cmd.setPaie(paieExistante + montant);
                return ResponseEntity.ok(commandeFournisseurService.save(cmd));
            }
        } catch (Exception e) {
            System.out.println("Warning: unable to persist paiement record: " + e.getMessage());
        }
        cmd.setPaie(paieExistante + montant);
        return ResponseEntity.ok(commandeFournisseurService.save(cmd));
    }

    @PostMapping("/{id}/reception")
    @Transactional
    public ResponseEntity<CommandeFournisseur> enregistrerReception(@PathVariable Long id, @RequestBody ReceptionRequest request, @RequestParam Long boutiqueId) {
        return commandeFournisseurService.findByIdAndBoutiqueId(id, boutiqueId)
                .map(cmd -> {
                    try {
                        if (request.getLignes() != null) {
                            request.getLignes().forEach(l -> {
                                Long ligneId = l.getLigneId();
                                if (ligneId == null) return;

                                // reject negative quantities early
                                if ((l.getQuantiteLivre() != null && l.getQuantiteLivre() < 0) || (l.getQuantiteConditionnement() != null && l.getQuantiteConditionnement() < 0)) {
                                    throw new IllegalArgumentException("Quantité de réception invalide");
                                }

                                ligneCommandeRepository.findById(ligneId).ifPresent(existing -> {
                                    // Determine new delivered quantity in UNITS. Accept either quantiteLivre (units) or quantiteConditionnement (conditionnement count)
                                    Integer newQteLivre;
                                    if (l.getQuantiteLivre() != null) {
                                        newQteLivre = l.getQuantiteLivre();
                                    } else if (l.getQuantiteConditionnement() != null && existing.getStock() != null && existing.getStock().getProduit() != null) {
                                        Integer mul = existing.getStock().getProduit().getNombreUnitesParConditionnement() == null ? 1 : existing.getStock().getProduit().getNombreUnitesParConditionnement();
                                        newQteLivre = l.getQuantiteConditionnement() * mul;
                                    } else {
                                        newQteLivre = existing.getQuantiteLivre();
                                    }
                                    Integer oldQteLivre = existing.getQuantiteLivre() != null ? existing.getQuantiteLivre() : 0;
                                    int delta = (newQteLivre != null ? newQteLivre : 0) - oldQteLivre;
                                    // update delivered quantity on ligne
                                    existing.setQuantiteLivre(newQteLivre);
                                    ligneCommandeRepository.save(existing);

                                    // If more items were received (delta > 0), create a Reception + LigneReception, update stock and create a RECEPTION mouvement
                                    if (delta > 0 && existing.getStock() != null && existing.getStock().getId() != null) {
                                        Long stockId = existing.getStock().getId();
                                        if (stockId != null) {
                                            stockRepository.findByIdForUpdate(stockId).ifPresent(stock -> {
                                                Integer currentQty = stock.getQuantiteDisponible() != null ? stock.getQuantiteDisponible() : 0;

                                                // Ensure costAverage is initialized when adding stock
                                                if (stock.getCostAverage() == null) {
                                                    java.math.BigDecimal purchaseUnitPrice = null;
                                                    if (existing.getNewPrice() != null) {
                                                        purchaseUnitPrice = java.math.BigDecimal.valueOf(existing.getNewPrice());
                                                    } else if (stock.getLastPurchasePrice() != null) {
                                                        purchaseUnitPrice = stock.getLastPurchasePrice();
                                                    } else if (stock.getProduit() != null && stock.getProduit().getPrixAchat() != null) {
                                                        purchaseUnitPrice = java.math.BigDecimal.valueOf(stock.getProduit().getPrixAchat());
                                                    }
                                                    if (purchaseUnitPrice == null) {
                                                        throw new IllegalArgumentException("Impossible de réceptionner : prix d'achat inconnu pour ce produit. Veuillez renseigner un prix d'achat ou prix sur la ligne de commande.");
                                                    }
                                                    stock.setCostAverage(purchaseUnitPrice);
                                                }

                                                // Create a Reception wrapper for this batch if not already created for this request
                                                // We'll create one Reception per API call linked to the commande
                                                Reception reception = new Reception();
                                                reception.setCommandeFournisseur(cmd);
                                                reception.setBoutique(new Boutique());
                                                reception.getBoutique().setId(boutiqueId);
                                                reception.setDateReception(java.time.LocalDateTime.now());
                                                reception = receptionService.save(reception);

                                                // Create LigneReception snapshot and link to the Reception
                                                LigneReception lr = new LigneReception();
                                                lr.setReception(reception);
                                                lr.setQuantiteRecu(delta);
                                                // save original conditionnement when provided in request (handled earlier) - fallback null
                                                // Note: the ReceptionRequest.ReceptionLigne provided quantiteConditionnement is not directly available here; however the controller previously computed delta from request, so we set quantiteConditionnement only when present in the request processing scope. For create per-call, set it from l.getQuantiteConditionnement() if available.
                                                lr.setQuantiteConditionnement(l.getQuantiteConditionnement());
                                                lr.setProduit(stock.getProduit());
                                                lr.setBeforeStockQuantite(currentQty);
                                                lr.setBeforeStockCostAverage(stock.getCostAverage());
                                                if (stock.getProduit() != null) lr.setBeforeProduitPrixAchat(stock.getProduit().getPrixAchat());
                                                ligneReceptionService.save(lr);

                                                // Update stock quantity
                                                stock.setQuantiteDisponible(currentQty + delta);
                                                stockRepository.save(stock);

                                                // create mouvement RECEPTION
                                                Mouvement mv = new Mouvement();
                                                mv.setStock(stock);
                                                mv.setProduit(stock.getProduit());
                                                mv.setQuantite(delta);
                                                mv.setTypeMouvement("RECEPTION");
                                                mv.setDateMouvement(java.time.LocalDateTime.now());
                                                // boutique for mouvement: if stock has magasin use its boutique, otherwise use commande.boutique
                                                if (stock.getMagasin() != null && stock.getMagasin().getBoutique() != null) mv.setBoutique(stock.getMagasin().getBoutique());
                                                else mv.setBoutique(cmd.getBoutique());
                                                mouvementService.save(mv);
                                            });
                                        }
                                    }
                                });
                            });
                        }
                        // Persist potential changes on the commande (if necessary, save the command)
                        CommandeFournisseur updated = commandeFournisseurService.save(cmd);
                        return ResponseEntity.ok(updated);
                    } catch (IllegalArgumentException ex) {
                        return ResponseEntity.status(org.springframework.http.HttpStatus.BAD_REQUEST).header("X-Error-Message", ex.getMessage()).body((CommandeFournisseur) null);
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }

    public static class PaiementRequest {
        private Integer montant;
        private String reference;
        private String date;
        private Integer timezoneOffsetMinutes; // client's timezone offset in minutes (optional)

        public Integer getMontant() {
            return montant;
        }

        public void setMontant(Integer montant) {
            this.montant = montant;
        }

        public String getReference() {
            return reference;
        }

        public void setReference(String reference) {
            this.reference = reference;
        }

        public String getDate() {
            return date;
        }

        public Integer getTimezoneOffsetMinutes() { return timezoneOffsetMinutes; }
        public void setTimezoneOffsetMinutes(Integer timezoneOffsetMinutes) { this.timezoneOffsetMinutes = timezoneOffsetMinutes; }

        public void setDate(String date) {
            this.date = date;
        }
    }

    public static class ReceptionRequest {
        private java.util.List<ReceptionLigne> lignes;

        public java.util.List<ReceptionLigne> getLignes() {
            return lignes;
        }

        public void setLignes(java.util.List<ReceptionLigne> lignes) {
            this.lignes = lignes;
        }
    }

    public static class ReceptionLigne {
        private Long ligneId;
        // quantity in units (preferred)
        private Integer quantiteLivre;
        // optional: quantity expressed in conditionnement (e.g., cartons)
        private Integer quantiteConditionnement;

        public Long getLigneId() {
            return ligneId;
        }

        public void setLigneId(Long ligneId) {
            this.ligneId = ligneId;
        }

        public Integer getQuantiteLivre() {
            return quantiteLivre;
        }

        public void setQuantiteLivre(Integer quantiteLivre) {
            this.quantiteLivre = quantiteLivre;
        }

        public Integer getQuantiteConditionnement() { return quantiteConditionnement; }
        public void setQuantiteConditionnement(Integer quantiteConditionnement) { this.quantiteConditionnement = quantiteConditionnement; }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateCommandeFournisseur(@PathVariable Long id, @RequestBody CommandeFournisseurRequest request) {
        Utilisateur current = getCurrentUser();
        return commandeFournisseurService.findById(id)
                .map(commande -> {
                    // simple permission check: if not superAdmin and not same boutique, forbid
                    if (!isSuperAdmin(current) && (current.getBoutique() == null || !current.getBoutique().getId().equals(commande.getBoutique().getId()))) {
                        return ResponseEntity.status(403).body("Accès refusé");
                    }

                    // Update main fields
                    commande.setReference(request.getReference());
                    try {
                        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
                        commande.setDateCommande(java.time.LocalDateTime.parse(request.getDateCommande().replace('T', ' '), formatter));
                    } catch (Exception ex) {
                        // ignore parse error, don't update date
                    }
                    commande.setTotal((int) request.getTotal());

                    // update fournisseur if provided
                    if (request.getFournisseur() != null && request.getFournisseur().getId() != null) {
                        Fournisseur f = new Fournisseur();
                        f.setId(request.getFournisseur().getId());
                        commande.setFournisseur(f);
                    }

                    // Process lignes: add/update/delete
                    List<com.smboutique.api.model.LigneCommande> existingLignes = ligneCommandeRepository.findByCommandeFournisseurId(commande.getId());
                    java.util.Map<Long, com.smboutique.api.model.LigneCommande> existingByStock = new java.util.HashMap<>();
                    for (com.smboutique.api.model.LigneCommande l : existingLignes) {
                        if (l.getStock() != null && l.getStock().getId() != null) {
                            existingByStock.put(l.getStock().getId(), l);
                        }
                    }

                    java.util.Set<Long> incomingStockIds = new java.util.HashSet<>();
                    if (request.getProduitsSelectionnes() != null) {
                        for (CommandeFournisseurRequest.ProduitSelectionne ps : request.getProduitsSelectionnes()) {
                            if (ps == null || ps.getId_stock() == null) continue;
                            Long stokId = ps.getId_stock();
                            incomingStockIds.add(stokId);
                            com.smboutique.api.model.LigneCommande existing = existingByStock.get(stokId);
                            if (existing != null) {
                                // update quantities/prices - support quantiteConditionnement
                                int effectiveQty = ps.getQuantite();
                                if (ps.getQuantiteConditionnement() != null) {
                                    if (ps.getQuantiteConditionnement() < 0) {
                                        java.util.Map<String, Object> err = new java.util.HashMap<>();
                                        err.put("error", "Quantité invalide");
                                        return ResponseEntity.status(org.springframework.http.HttpStatus.BAD_REQUEST).body(err);
                                    }
                                    int mul = 1;
                                    if (existing.getStock() != null && existing.getStock().getProduit() != null && existing.getStock().getProduit().getNombreUnitesParConditionnement() != null) {
                                        mul = existing.getStock().getProduit().getNombreUnitesParConditionnement();
                                    } else {
                                        java.util.Optional<Stock> sOpt = stockRepository.findById(stokId);
                                        if (sOpt.isPresent() && sOpt.get().getProduit() != null && sOpt.get().getProduit().getNombreUnitesParConditionnement() != null) mul = sOpt.get().getProduit().getNombreUnitesParConditionnement();
                                    }
                                    effectiveQty = ps.getQuantiteConditionnement() * mul;
                                }
                                existing.setQuantite(effectiveQty);
                                existing.setQuantiteConditionnement(ps.getQuantiteConditionnement());
                                existing.setNewPrice((int) ps.getPrix());
                                ligneCommandeRepository.save(existing);
                                // also update the in-memory commande.lignes if present
                                if (commande.getLignes() != null) {
                                    for (com.smboutique.api.model.LigneCommande lc : commande.getLignes()) {
                                        if (lc.getId() != null && lc.getId().equals(existing.getId())) {
                                            lc.setQuantite(existing.getQuantite());
                                            lc.setQuantiteConditionnement(existing.getQuantiteConditionnement());
                                            lc.setNewPrice(existing.getNewPrice());
                                            break;
                                        }
                                    }
                                }
                            } else {
                                // create new ligne
                                com.smboutique.api.model.LigneCommande newL = new com.smboutique.api.model.LigneCommande();
                                java.util.Optional<Stock> stockOpt = stockRepository.findById(java.util.Objects.requireNonNull(stokId));
                                if (!stockOpt.isPresent()) {
                                    continue; // skip invalid stock id
                                }
                                Stock s = stockOpt.get();
                                newL.setStock(s);
                                int effectiveQtyNew = ps.getQuantite();
                                if (ps.getQuantiteConditionnement() != null) {
                                    if (ps.getQuantiteConditionnement() < 0) {
                                        java.util.Map<String, Object> err = new java.util.HashMap<>();
                                        err.put("error", "Quantité invalide");
                                        return ResponseEntity.status(org.springframework.http.HttpStatus.BAD_REQUEST).body(err);
                                    }
                                    int mul = 1;
                                    if (s.getProduit() != null && s.getProduit().getNombreUnitesParConditionnement() != null) mul = s.getProduit().getNombreUnitesParConditionnement();
                                    effectiveQtyNew = ps.getQuantiteConditionnement() * mul;
                                }
                                newL.setQuantite(effectiveQtyNew);
                                newL.setQuantiteConditionnement(ps.getQuantiteConditionnement());
                                newL.setNewPrice((int) ps.getPrix());
                                newL.setCommandeFournisseur(commande);
                                // add to commande.lignes so cascade will persist it when saving commande
                                if (commande.getLignes() == null) commande.setLignes(new java.util.ArrayList<>());
                                commande.getLignes().add(newL);
                            }
                        }
                    }

                    // delete those existing lignes not present in incomingStockIds (if allowed)
                    java.util.List<java.util.Map<String, Object>> blockedDeletes = new java.util.ArrayList<>();
                    for (com.smboutique.api.model.LigneCommande l : existingLignes) {
                        Long stockId = l.getStock() != null ? l.getStock().getId() : null;
                        if (stockId == null) continue;
                        if (!incomingStockIds.contains(stockId)) {
                            Integer qteLivre = l.getQuantiteLivre() != null ? l.getQuantiteLivre() : 0;
                            if (qteLivre > 0) {
                                java.util.Map<String, Object> b = new java.util.HashMap<>();
                                b.put("id", l.getId());
                                String name = null;
                                if (l.getStock() != null && l.getStock().getProduit() != null) {
                                    name = l.getStock().getProduit().getNomProduit();
                                }
                                b.put("name", name != null ? name : "");
                                blockedDeletes.add(b);
                            } else {
                                // remove from parent's collection to trigger orphanRemoval
                                if (commande.getLignes() != null) {
                                    commande.getLignes().removeIf(existing -> existing.getId() != null && existing.getId().equals(l.getId()));
                                }
                            }
                        }
                    }

                    if (!blockedDeletes.isEmpty()) {
                        java.util.Map<String, Object> err = new java.util.HashMap<>();
                        err.put("error", "Impossible de supprimer certaines lignes car des quantités ont déjà été réceptionnées");
                        err.put("blockedLignes", blockedDeletes);
                        return ResponseEntity.badRequest().body(err);
                    }

                    // Save the commande, with orphanRemoval active the deleted lignes will be removed in DB
                    CommandeFournisseur updated = commandeFournisseurService.save(commande);
                    // Log summary
                    System.out.println("[UPDATE COMMANDE] id=" + commande.getId() + " saved with lignes=" + (updated.getLignes() == null ? 0 : updated.getLignes().size()));
                    return ResponseEntity.ok(updated);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteCommandeFournisseur(@PathVariable Long id) {
        return commandeFournisseurService.findById(id)
                .map(commandeFournisseur -> {
                    // Check if there are any receptions for this commande
                    List<Reception> receptions = receptionRepository.findByCommandeFournisseurId(id);
                    if (!receptions.isEmpty()) {
                        Map<String, Object> error = new HashMap<>();
                        error.put("error", "Cannot delete commande fournisseur with existing receptions");
                        error.put("receptionsCount", receptions.size());
                        return ResponseEntity.badRequest().body(error);
                    }
                    // Check if any ligne has been received (quantiteLivre > 0)
                    boolean hasReceivedItems = commandeFournisseur.getLignes().stream()
                            .anyMatch(ligne -> ligne.getQuantiteLivre() != null && ligne.getQuantiteLivre() > 0);
                    if (hasReceivedItems) {
                        Map<String, Object> error = new HashMap<>();
                        error.put("error", "Cannot delete commande fournisseur with received items");
                        return ResponseEntity.badRequest().body(error);
                    }
                    commandeFournisseurService.deleteById(id);
                    return ResponseEntity.ok().build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private boolean hasItemsToReceive(CommandeFournisseur commande) {
        return commande.getLignes().stream()
                .anyMatch(ligne -> ligne.getQuantite() > (ligne.getQuantiteLivre() != null ? ligne.getQuantiteLivre() : 0));
    }

    private CommandeFournisseurDTO convertToDTO(CommandeFournisseur commande) {
        CommandeFournisseurDTO dto = new CommandeFournisseurDTO();
        dto.setId(commande.getId());
        dto.setReference(commande.getReference());
        // Format dateCommande as a server-local timestamp (no zone offset) so clients display the same wall time the user entered
        if (commande.getDateCommande() != null) {
            dto.setDateCommande(commande.getDateCommande().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        } else {
            dto.setDateCommande("");
        }
        dto.setTotal(commande.getTotal());

        // Set fournisseur
        if (commande.getFournisseur() != null) {
            CommandeFournisseurDTO.FournisseurDTO fournisseurDTO = new CommandeFournisseurDTO.FournisseurDTO();
            fournisseurDTO.setId(commande.getFournisseur().getId());
            fournisseurDTO.setPrenom(commande.getFournisseur().getPrenom());
            fournisseurDTO.setNom(commande.getFournisseur().getNom());
            dto.setFournisseur(fournisseurDTO);
        }

        // Build lignes details with product unit info so clients can render correct unit labels
        if (commande.getLignes() != null) {
            java.util.List<CommandeFournisseurDTO.LigneDTO> ld = new java.util.ArrayList<>();
            for (com.smboutique.api.model.LigneCommande l : commande.getLignes()) {
                CommandeFournisseurDTO.LigneDTO li = new CommandeFournisseurDTO.LigneDTO();
                li.setId(l.getId());
                li.setQuantite(l.getQuantite());
                li.setQuantiteConditionnement(l.getQuantiteConditionnement());
                li.setPrix(l.getPrice());
                Integer q = l.getQuantite() != null ? l.getQuantite() : 0;
                Integer p = l.getPrice() != null ? l.getPrice() : 0;
                li.setMontant(p * q * 1.0);
                if (l.getStock() != null) {
                    li.setStockId(l.getStock().getId());
                    // Determine depot name: prefer magasin name when present, else boutique name, else empty
                    String depotName = "";
                    if (l.getStock().getMagasin() != null && l.getStock().getMagasin().getNom() != null) depotName = l.getStock().getMagasin().getNom();
                    else if (l.getStock().getBoutique() != null && l.getStock().getBoutique().getNom() != null) depotName = l.getStock().getBoutique().getNom();
                    li.setDepot(depotName);

                    if (l.getStock().getProduit() != null) {
                        li.setProduitId(l.getStock().getProduit().getId());
                        li.setNom(l.getStock().getProduit().getNomProduit());
                        li.setMultiplicateur(l.getStock().getProduit().getNombreUnitesParConditionnement());
                        if (l.getStock().getProduit().getUnite() != null) {
                            CommandeFournisseurDTO.LigneDTO.UniteDTO u = new CommandeFournisseurDTO.LigneDTO.UniteDTO();
                            u.setId(l.getStock().getProduit().getUnite().getId());
                            u.setLibelle(l.getStock().getProduit().getUnite().getLibelle());
                            u.setSymbole(l.getStock().getProduit().getUnite().getSymbole());                            u.setCode(l.getStock().getProduit().getUnite().getCode());                            li.setUnite(u);
                        }
                    }
                }
                ld.add(li);
            }
            dto.setLignes(ld);
        }

        // Calculate percentages (reused logic)
        dto.setPourcentageRecu(calculatePourcentageRecu(commande));
        double pourcentagePaye = calculatePourcentagePaye(commande, dto.getTotal());
        dto.setPourcentagePaye(pourcentagePaye);
        dto.setMontantPaye(commande.getPaie() != null ? commande.getPaie() : 0);

        return dto;
    }

    private double calculatePourcentageRecu(CommandeFournisseur commande) {
        if (commande.getLignes() == null || commande.getLignes().isEmpty()) {
            return 0.0;
        }

        int totalCommande = commande.getLignes().stream()
                .mapToInt(com.smboutique.api.model.LigneCommande::getQuantite)
                .sum();

        int totalLivre = commande.getLignes().stream()
                .mapToInt(ligne -> ligne.getQuantiteLivre() != null ? ligne.getQuantiteLivre() : 0)
                .sum();

        if (totalCommande == 0) {
            return 0.0;
        }

        return (double) totalLivre / totalCommande * 100.0;
    }

    private double calculatePourcentagePaye(CommandeFournisseur commande, double total) {
        if (total == 0.0) return 0.0;
        Integer paie = commande.getPaie() != null ? commande.getPaie() : 0;
        return (double) paie / total * 100.0;
    }
}