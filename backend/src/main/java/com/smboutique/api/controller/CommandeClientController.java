package com.smboutique.api.controller;

import com.smboutique.api.model.CommandeClient;
import com.smboutique.api.service.CommandeClientService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/commandes-clients")
@CrossOrigin(origins = "*")
public class CommandeClientController {

    private static final Logger logger = LoggerFactory.getLogger(CommandeClientController.class);

    @Autowired
    private CommandeClientService commandeClientService;

    @Autowired
    private com.smboutique.api.service.PdfService pdfService;

    @Autowired
    private com.smboutique.api.repository.StockRepository stockRepository;

    @Autowired
    private com.smboutique.api.repository.ProduitRepository produitRepository;

    @Autowired
    private com.smboutique.api.repository.ClientGrossisteRepository clientGrossisteRepository;

    @Autowired
    private com.smboutique.api.service.LigneCommandeClientService ligneCommandeClientService;

    @Autowired
    private com.smboutique.api.service.PaiementClientService paiementClientService;

    @Autowired
    private com.smboutique.api.repository.CaisseRepository caisseRepository;

    @Autowired
    private com.smboutique.api.service.CaisseService caisseService;

    @GetMapping
    public List<CommandeClient> getAllCommandeClients() {
        return commandeClientService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<CommandeClient> getCommandeClientById(@PathVariable Long id) {
        return commandeClientService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/pdf")
    public void getCommandeClientPdf(@PathVariable Long id, jakarta.servlet.http.HttpServletResponse response) {
        try {
            pdfService.writeCommandeClientPdf(id, response);
        } catch (Exception e) {
            try { response.sendError(500, e.getMessage()); } catch (java.io.IOException ex) { /* ignore */ }
        }
    }

    @PostMapping
    public CommandeClient createCommandeClient(@RequestBody CommandeClient commandeClient) {
        return commandeClientService.save(commandeClient);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateCommandeClient(@PathVariable Long id, @RequestBody java.util.Map<String, Object> payload) {
        return commandeClientService.findById(id)
                .map(commandeClient -> {
                    try {
                        if (payload.containsKey("reference")) commandeClient.setReference((String) payload.get("reference"));
                        if (payload.containsKey("dateCommande") || payload.containsKey("dateVente")) {
                            String dt = payload.containsKey("dateCommande") ? (String) payload.get("dateCommande") : (String) payload.get("dateVente");
                            if (dt != null) commandeClient.setDateCommande(java.time.LocalDateTime.parse(dt));
                        }
                        if (payload.containsKey("total")) commandeClient.setTotal(((Number) payload.get("total")).intValue());
                        if (payload.containsKey("paie")) commandeClient.setPaie(((Number) payload.get("paie")).intValue());
                        if (payload.containsKey("client") && payload.get("client") instanceof java.util.Map) {
                            java.util.Map<?,?> c = (java.util.Map<?,?>) payload.get("client");
                            if (c.get("id") != null) {
                                Long cid = Long.parseLong(String.valueOf(c.get("id")));
                                com.smboutique.api.model.ClientGrossiste clientEntity = clientGrossisteRepository.findById(cid).orElse(null);
                                if (clientEntity != null) commandeClient.setClient(clientEntity);
                            }
                        }

                        // Process produitsSelectionnes if provided (update/create/delete lignes)
                        if (payload.containsKey("produitsSelectionnes") && payload.get("produitsSelectionnes") instanceof java.util.List) {
                            java.util.List<?> list = (java.util.List<?>) payload.get("produitsSelectionnes");
                            // Track processed ligne ids
                            java.util.Set<Long> processed = new java.util.HashSet<>();

                            // Build map of existing lignes
                            java.util.Map<Long, com.smboutique.api.model.LigneCommandeClient> existing = new java.util.HashMap<>();
                            for (com.smboutique.api.model.LigneCommandeClient l : commandeClient.getLignes()) {
                                if (l.getId() != null) existing.put(l.getId(), l);
                            }

                            for (Object o : list) {
                                if (!(o instanceof java.util.Map)) continue;
                                java.util.Map<?,?> lm = (java.util.Map<?,?>) o;
                                Long ligneId = lm.get("ligneId") != null ? Long.parseLong(String.valueOf(lm.get("ligneId"))) : null;

                                if (ligneId != null && existing.containsKey(ligneId)) {
                                    // update existing ligne
                                    com.smboutique.api.model.LigneCommandeClient lcc = existing.get(ligneId);
                                    // compute quantite
                                    Integer q = null;
                                    if (lm.get("venteParConditionnement") != null && Boolean.TRUE.equals(lm.get("venteParConditionnement"))) {
                                        Integer qCond = lm.get("quantiteConditionnement") != null ? Integer.parseInt(String.valueOf(lm.get("quantiteConditionnement"))) : 0;
                                        Integer mul = lcc.getProduit() != null ? (lcc.getProduit().getNombreUnitesParConditionnement() != null ? lcc.getProduit().getNombreUnitesParConditionnement() : 0) : 0;
                                        q = qCond * mul;
                                    } else if (lm.get("quantite") != null) {
                                        q = Integer.parseInt(String.valueOf(lm.get("quantite")));
                                    }
                                    if (q != null) lcc.setQuantite(q);

                                    if (lm.get("prix") != null) lcc.setNewPrice(Integer.parseInt(String.valueOf(lm.get("prix"))));
                                    if (lm.get("priceMode") != null) {
                                        try { lcc.setPriceMode(com.smboutique.api.model.PriceMode.valueOf(String.valueOf(lm.get("priceMode")))); } catch (Exception ignore) {}
                                    }
                                    ligneCommandeClientService.save(lcc);
                                    processed.add(lcc.getId());
                                } else {
                                    // new ligne
                                    com.smboutique.api.model.LigneCommandeClient lcc = new com.smboutique.api.model.LigneCommandeClient();
                                    // try id_stock -> product
                                    if (lm.get("id_stock") != null) {
                                        Long sid = Long.parseLong(String.valueOf(lm.get("id_stock")));
                                        com.smboutique.api.model.Stock s = stockRepository.findById(sid).orElse(null);
                                        if (s != null) lcc.setProduit(s.getProduit());
                                    } else if (lm.get("produitId") != null) {
                                        Long pid = Long.parseLong(String.valueOf(lm.get("produitId")));
                                        com.smboutique.api.model.Produit p = produitRepository.findById(pid).orElse(null);
                                        if (p != null) lcc.setProduit(p);
                                    }

                                    // set quantity
                                    Integer q = 0;
                                    if (lm.get("venteParConditionnement") != null && Boolean.TRUE.equals(lm.get("venteParConditionnement"))) {
                                        Integer qCond = lm.get("quantiteConditionnement") != null ? Integer.parseInt(String.valueOf(lm.get("quantiteConditionnement"))) : 0;
                                        Integer mul = lcc.getProduit() != null ? (lcc.getProduit().getNombreUnitesParConditionnement() != null ? lcc.getProduit().getNombreUnitesParConditionnement() : 0) : 0;
                                        q = qCond * mul;
                                    } else if (lm.get("quantite") != null) {
                                        q = Integer.parseInt(String.valueOf(lm.get("quantite")));
                                    }
                                    lcc.setQuantite(q);
                                    lcc.setQuantiteLivre(0);

                                    if (lm.get("prix") != null) lcc.setNewPrice(Integer.parseInt(String.valueOf(lm.get("prix"))));
                                    if (lm.get("priceMode") != null) {
                                        try { lcc.setPriceMode(com.smboutique.api.model.PriceMode.valueOf(String.valueOf(lm.get("priceMode")))); } catch (Exception ignore) {}
                                    }

                                    lcc.setCommandeClient(commandeClient);
                                    com.smboutique.api.model.LigneCommandeClient savedL = ligneCommandeClientService.save(lcc);
                                    if (savedL.getId() != null) processed.add(savedL.getId());
                                }
                            }

                            // delete removed lignes
                            for (com.smboutique.api.model.LigneCommandeClient existingL : new java.util.ArrayList<>(commandeClient.getLignes())) {
                                if (existingL.getId() != null && !processed.contains(existingL.getId())) {
                                    ligneCommandeClientService.deleteById(existingL.getId());
                                }
                            }

                            // reload lignes onto commande client
                            commandeClient.setLignes(ligneCommandeClientService.findAll().stream().filter(l -> l.getCommandeClient() != null && l.getCommandeClient().getId().equals(commandeClient.getId())).collect(java.util.stream.Collectors.toList()));
                        }

                        return ResponseEntity.ok(commandeClientService.save(commandeClient));
                    } catch (Exception ex) {
                        return ResponseEntity.status(500).body(ex.getMessage());
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // Enregistrer un paiement pour une commande client (créé un PaiementClient et met à jour le champ paie de la commande)
    @PostMapping("/{id}/paiement")
    public ResponseEntity<CommandeClient> enregistrerPaiement(@PathVariable Long id, @RequestBody PaiementRequest request) {
        try {
            java.util.Optional<CommandeClient> cmdOpt = commandeClientService.findById(id);
            if (!cmdOpt.isPresent()) return ResponseEntity.notFound().build();
            CommandeClient cmd = cmdOpt.get();
            int montant = request.getMontant() != null ? request.getMontant() : 0;
            logger.info("Paiement client incoming: commandeId={}, montant={}", id, montant);
            Integer paieExistante = cmd.getPaie() != null ? cmd.getPaie() : 0;
            Integer totalCommande = cmd.getTotal() != null ? cmd.getTotal() : 0;
            if (montant <= 0) return ResponseEntity.badRequest().build();
            if (paieExistante + montant > totalCommande) return ResponseEntity.badRequest().build();

            // Prepare flags for caisse update visible outside the persisting try block
            boolean caisseUpdated = false;
            Integer caisseNewTotal = null;

            // Persist a PaiementClient record for historization
            try {
                // Compute client's local date/time from provided date and timezoneOffsetMinutes (if any)
                java.time.LocalDateTime clientLocalDateTime = null;
                if (request.getDate() != null && !request.getDate().trim().isEmpty()) {
                    try {
                        String dr = request.getDate();
                        if (dr.contains("T") && (dr.endsWith("Z") || dr.matches(".*[+-]\\d{2}:?\\d{2}$"))) {
                            java.time.Instant inst;
                            try {
                                inst = java.time.Instant.parse(dr);
                            } catch (Exception e) {
                                inst = java.time.OffsetDateTime.parse(dr).toInstant();
                            }
                            if (request.getTimezoneOffsetMinutes() != null) {
                                int off = request.getTimezoneOffsetMinutes();
                                java.time.ZoneOffset zo = java.time.ZoneOffset.ofTotalSeconds(-off * 60);
                                clientLocalDateTime = java.time.LocalDateTime.ofInstant(inst, zo);
                            } else {
                                clientLocalDateTime = java.time.LocalDateTime.ofInstant(inst, java.time.ZoneId.systemDefault());
                            }
                        } else {
                            try {
                                java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
                                clientLocalDateTime = java.time.LocalDateTime.parse(dr, fmt);
                            } catch (Exception ex2) {
                                clientLocalDateTime = java.time.LocalDateTime.now();
                            }
                        }
                    } catch (Exception ex) {
                        clientLocalDateTime = java.time.LocalDateTime.now();
                    }
                } else {
                    clientLocalDateTime = java.time.LocalDateTime.now();
                }

                com.smboutique.api.model.PaiementClient paiement = new com.smboutique.api.model.PaiementClient();
                paiement.setMontantPaye(montant);
                // Generate a server-side payment reference consistent with the client's local time
                String generatedRef = "PAY-" + clientLocalDateTime.format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd")) + "-" + clientLocalDateTime.format(java.time.format.DateTimeFormatter.ofPattern("HHmmss"));
                // Use a server-generated reference based on client's local time for consistency
                paiement.setReference(generatedRef);
                paiement.setDatePaie(clientLocalDateTime);
                paiement.setCommandeClient(cmd);

                // Attach active caisse reference for the boutique if available
                if (cmd.getBoutique() != null && cmd.getBoutique().getId() != null) {
                    Long bid = cmd.getBoutique().getId();
                    java.util.Optional<com.smboutique.api.model.Caisse> maybeCaisse = caisseRepository.findFirstByBoutiqueIdOrderByIdDesc(bid);
                    if (maybeCaisse.isPresent()) {
                        com.smboutique.api.model.Caisse caisse = maybeCaisse.get();
                        // consider only open/active caisses (statut values may vary across deploys)
                        String s = caisse.getStatut() == null ? "" : caisse.getStatut().toLowerCase();
                        if (s.contains("ouv") || s.contains("act") || s.contains("open")) {
                            paiement.setReferenceCaisse(caisse.getReference());
                        }
                    }
                }

                // Save paiement via service
                paiementClientService.save(paiement);

                // If a caisse is active for this boutique, increment its montantTotal
                try {
                    if (cmd.getBoutique() != null && cmd.getBoutique().getId() != null) {
                        Long bid = cmd.getBoutique().getId();
                        java.util.Optional<com.smboutique.api.model.Caisse> maybeCaisse = caisseRepository.findFirstByBoutiqueIdOrderByIdDesc(bid);
                        if (maybeCaisse.isPresent()) {
                            com.smboutique.api.model.Caisse caisse = maybeCaisse.get();
                            logger.info("Found caisse for boutique {}: id={}, numero={}, statut={}, montantTotal={}", bid, caisse.getId(), caisse.getNumero(), caisse.getStatut(), caisse.getMontantTotal());
                            String s = caisse.getStatut() == null ? "" : caisse.getStatut().toUpperCase();
                            if (s.contains("OUVERTE") || s.contains("OPEN") || s.contains("ACT")) {
                                Integer cur = caisse.getMontantTotal() != null ? caisse.getMontantTotal() : 0;
                                caisse.setMontantTotal(cur + montant);
                                caisse = caisseService.save(caisse);
                                logger.info("Caisse updated for boutique {}: new montantTotal={}", bid, caisse.getMontantTotal());
                                caisseUpdated = true;
                                caisseNewTotal = caisse.getMontantTotal();
                            } else {
                                logger.info("Caisse not active (statut={}), not updating montantTotal", caisse.getStatut());
                            }
                        } else {
                            logger.info("No caisse found for boutique {} to update", bid);
                        }
                    }
                } catch (Exception ex) {
                    logger.warn("Unable to update caisse total: {}", ex.getMessage());
                }
            } catch (Exception e) {
                System.out.println("Warning: unable to persist paiement client record: " + e.getMessage());
            }

            cmd.setPaie(paieExistante + montant);
            com.smboutique.api.model.CommandeClient savedCmd = commandeClientService.save(cmd);
            ResponseEntity.BodyBuilder builder = ResponseEntity.ok();
            builder.header("X-Caisse-Updated", String.valueOf(caisseUpdated));
            if (caisseNewTotal != null) builder.header("X-Caisse-Total", String.valueOf(caisseNewTotal));
            return builder.body(savedCmd);
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(null);
        }
    }

    public static class PaiementRequest {
        private Integer montant;
        private String reference;
        private String date;
        private Integer timezoneOffsetMinutes;

        public Integer getMontant() { return montant; }
        public void setMontant(Integer montant) { this.montant = montant; }
        public String getReference() { return reference; }
        public void setReference(String reference) { this.reference = reference; }
        public String getDate() { return date; }
        public void setDate(String date) { this.date = date; }
        public Integer getTimezoneOffsetMinutes() { return timezoneOffsetMinutes; }
        public void setTimezoneOffsetMinutes(Integer timezoneOffsetMinutes) { this.timezoneOffsetMinutes = timezoneOffsetMinutes; }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCommandeClient(@PathVariable Long id) {
        return commandeClientService.findById(id)
                .map(commandeClient -> {
                    commandeClientService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
