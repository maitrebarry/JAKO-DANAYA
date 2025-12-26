package com.smboutique.api.controller;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.CommandeFournisseur;
import com.smboutique.api.model.Fournisseur;
import com.smboutique.api.model.Stock;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.LigneCommandeRepository;
import com.smboutique.api.model.Paiement;
import com.smboutique.api.service.PaiementService;
import java.time.LocalDateTime;
import com.smboutique.api.dto.CommandeFournisseurDTO;
import com.smboutique.api.service.CommandeFournisseurService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/api/commandes-fournisseurs")
@CrossOrigin(origins = "*")
public class CommandeFournisseurController {

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
    private com.smboutique.api.service.PdfService pdfService;

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
        boolean hasRole = user.getRoles() != null && user.getRoles().stream()
                .anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
        boolean hasType = "SUPERADMIN".equalsIgnoreCase(user.getTypeUtilisateur());
        return hasRole || hasType;
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
    public ResponseEntity<CommandeFournisseur> getCommandeFournisseurById(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        if (isSuperAdmin(current)) {
            return commandeFournisseurService.findById(id)
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        }
        if (current.getBoutique() == null) {
            return ResponseEntity.status(403).build();
        }
        return commandeFournisseurService.findByIdAndBoutiqueId(id, current.getBoutique().getId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/pdf")
    public void getCommandePdf(@PathVariable Long id, jakarta.servlet.http.HttpServletResponse response) {
        try {
            pdfService.writeCommandePdf(id, response);
        } catch (Exception e) {
            try {
                response.sendError(500, e.getMessage());
            } catch (java.io.IOException ioEx) {
                // ignore
            }
        }
    }

    @PostMapping
    public CommandeFournisseur createCommandeFournisseur(@RequestBody CommandeFournisseurRequest request) {
        // Get current user
        Utilisateur currentUser = getCurrentUser();
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

        // Create lignes
        List<com.smboutique.api.model.LigneCommande> lignes = new java.util.ArrayList<>();
        for (CommandeFournisseurRequest.ProduitSelectionne ps : request.getProduitsSelectionnes()) {
            com.smboutique.api.model.LigneCommande ligne = new com.smboutique.api.model.LigneCommande();
            Stock stock = new Stock();
            stock.setId(ps.getId_stock());
            ligne.setStock(stock);
            ligne.setQuantite(ps.getQuantite());
            ligne.setNewPrice((int) ps.getPrix());
            ligne.setCommandeFournisseur(commande);
            lignes.add(ligne);
        }
        commande.setLignes(lignes);

        return commandeFournisseurService.save(commande);
    }
    @PostMapping("/{id}/paiement")
    public ResponseEntity<CommandeFournisseur> enregistrerPaiement(@PathVariable Long id, @RequestBody PaiementRequest request) {
        Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && (current.getBoutique() == null)) {
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
            paiement.setReference(request.getReference());
            if (request.getDate() != null && !request.getDate().trim().isEmpty()) {
                try {
                    String dr = request.getDate();
                    // try parsing ISO instant with timezone
                    if (dr.contains("T") && (dr.endsWith("Z") || dr.matches(".*[+-]\\d{2}:?\\d{2}$"))) {
                        java.time.Instant inst = java.time.Instant.parse(dr);
                        if (request.getTimezoneOffsetMinutes() != null) {
                            // Convert instant to client's local time using client timezone offset
                            int off = request.getTimezoneOffsetMinutes();
                            java.time.ZoneOffset zo = java.time.ZoneOffset.ofTotalSeconds(-off * 60);
                            paiement.setDatePaie(LocalDateTime.ofInstant(inst, zo));
                        } else {
                            // Fallback: place instant in server default zone
                            paiement.setDatePaie(LocalDateTime.ofInstant(inst, java.time.ZoneId.systemDefault()));
                        }
                    } else {
                        // fallback parse common patterns like dd/MM/yyyy HH:mm:ss
                        try {
                            java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
                            // If client passed timezoneOffsetMinutes with a local-formatted date, we should interpret it as client's local time
                            LocalDateTime parsed = LocalDateTime.parse(dr, fmt);
                            if (request.getTimezoneOffsetMinutes() != null) {
                                // no conversion needed: store parsed local client time as-is
                                paiement.setDatePaie(parsed);
                            } else {
                                paiement.setDatePaie(parsed);
                            }
                        } catch (Exception ex2) {
                            // last resort: parse as LocalDateTime
                            paiement.setDatePaie(LocalDateTime.parse(dr));
                        }
                    }
                } catch (Exception ex) {
                    paiement.setDatePaie(LocalDateTime.now());
                }
            } else {
                paiement.setDatePaie(LocalDateTime.now());
            }
            paiement.setCommandeFournisseur(cmd);
            paiementService.save(paiement);
        } catch (Exception e) {
            System.out.println("Warning: unable to persist paiement record: " + e.getMessage());
        }
        cmd.setPaie(paieExistante + montant);
        return ResponseEntity.ok(commandeFournisseurService.save(cmd));
    }

    @PostMapping("/{id}/reception")
    public ResponseEntity<CommandeFournisseur> enregistrerReception(@PathVariable Long id, @RequestBody ReceptionRequest request, @RequestParam Long boutiqueId) {
        return commandeFournisseurService.findByIdAndBoutiqueId(id, boutiqueId)
                .map(cmd -> {
                    if (request.getLignes() != null) {
                        request.getLignes().forEach(l -> {
                            Long ligneId = l.getLigneId();
                            if (ligneId == null) return;
                            ligneCommandeRepository.findById(ligneId).ifPresent(existing -> {
                                Integer newQteLivre = l.getQuantiteLivre() != null ? l.getQuantiteLivre() : existing.getQuantiteLivre();
                                Integer oldQteLivre = existing.getQuantiteLivre() != null ? existing.getQuantiteLivre() : 0;
                                int delta = (newQteLivre != null ? newQteLivre : 0) - oldQteLivre;
                                // update delivered quantity on ligne
                                existing.setQuantiteLivre(newQteLivre);
                                ligneCommandeRepository.save(existing);

                                // If more items were received (delta > 0), update stock's quantiteDisponible
                                if (delta > 0 && existing.getStock() != null && existing.getStock().getId() != null) {
                                    Long stockId = existing.getStock().getId();
                                    if (stockId != null) {
                                        stockRepository.findById(stockId).ifPresent(stock -> {
                                            Integer currentQty = stock.getQuantiteDisponible() != null ? stock.getQuantiteDisponible() : 0;
                                            stock.setQuantiteDisponible(currentQty + delta);
                                            stockRepository.save(stock);
                                        });
                                    }
                                }
                            });
                        });
                    }
                    // Persist potential changes on the commande (if necessary, save the command)
                    CommandeFournisseur updated = commandeFournisseurService.save(cmd);
                    return ResponseEntity.ok(updated);
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
        private Integer quantiteLivre;

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
                                // update quantities/prices
                                existing.setQuantite(ps.getQuantite());
                                existing.setNewPrice((int) ps.getPrix());
                                ligneCommandeRepository.save(existing);
                                // also update the in-memory commande.lignes if present
                                if (commande.getLignes() != null) {
                                    for (com.smboutique.api.model.LigneCommande lc : commande.getLignes()) {
                                        if (lc.getId() != null && lc.getId().equals(existing.getId())) {
                                            lc.setQuantite(existing.getQuantite());
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
                                newL.setQuantite(ps.getQuantite());
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
    public ResponseEntity<Void> deleteCommandeFournisseur(@PathVariable Long id) {
        return commandeFournisseurService.findById(id)
                .map(commandeFournisseur -> {
                    commandeFournisseurService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
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
        dto.setDateCommande(commande.getDateCommande().toString());
        dto.setTotal(commande.getTotal());

        // Set fournisseur
        if (commande.getFournisseur() != null) {
            CommandeFournisseurDTO.FournisseurDTO fournisseurDTO = new CommandeFournisseurDTO.FournisseurDTO();
            fournisseurDTO.setId(commande.getFournisseur().getId());
            fournisseurDTO.setPrenom(commande.getFournisseur().getPrenom());
            fournisseurDTO.setNom(commande.getFournisseur().getNom());
            dto.setFournisseur(fournisseurDTO);
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