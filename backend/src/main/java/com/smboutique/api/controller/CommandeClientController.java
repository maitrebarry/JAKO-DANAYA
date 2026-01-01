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
    private com.smboutique.api.service.UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.repository.CaisseRepository caisseRepository;

    @Autowired
    private com.smboutique.api.service.CaisseService caisseService;

    @Autowired
    private com.smboutique.api.service.CaisseTransactionService caisseTransactionService;

    @Autowired
    private com.smboutique.api.service.CaisseMovementService caisseMovementService;

    // Helper to get authenticated user
    private com.smboutique.api.model.Utilisateur getCurrentUser() {
        org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("Utilisateur authentifié introuvable");
        }
        return utilisateurService.findByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Utilisateur authentifié introuvable"));
    }

    private boolean isSuperAdmin(com.smboutique.api.model.Utilisateur user) {
        if (user == null) return false;
        return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
    }

    @GetMapping
    public List<CommandeClient> getAllCommandeClients() {
        com.smboutique.api.model.Utilisateur current = getCurrentUser();
        if (isSuperAdmin(current)) {
            return commandeClientService.findAll();
        }
        if (current.getBoutique() == null) {
            return List.of();
        }
        return commandeClientService.findAllByBoutiqueId(current.getBoutique().getId());
    }

    @GetMapping("/boutique/{boutiqueId}")
    public List<CommandeClient> getAllCommandeClientsByBoutique(@PathVariable Long boutiqueId) {
        com.smboutique.api.model.Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && (current.getBoutique() == null || !current.getBoutique().getId().equals(boutiqueId))) {
            return List.of();
        }
        return commandeClientService.findAllByBoutiqueId(boutiqueId);
    }

    @GetMapping("/{id}")
    public ResponseEntity<CommandeClient> getCommandeClientById(@PathVariable Long id) {
        com.smboutique.api.model.Utilisateur current = getCurrentUser();
        if (isSuperAdmin(current)) {
            return commandeClientService.findById(id)
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        }
        if (current.getBoutique() == null) {
            return ResponseEntity.status(403).build();
        }
        return commandeClientService.findByIdAndBoutiqueId(id, current.getBoutique().getId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/pdf")
    public void getCommandeClientPdf(@PathVariable Long id, jakarta.servlet.http.HttpServletResponse response) {
        try {
            com.smboutique.api.model.Utilisateur current = getCurrentUser();
            if (!isSuperAdmin(current)) {
                if (current.getBoutique() == null) { response.sendError(403); return; }
                boolean ok = commandeClientService.findByIdAndBoutiqueId(id, current.getBoutique().getId()).isPresent();
                if (!ok) { response.sendError(404); return; }
            }
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
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> enregistrerPaiement(@PathVariable Long id, @RequestBody PaiementRequest request) {
        try {
            java.util.Optional<CommandeClient> cmdOpt = commandeClientService.findById(id);
            if (!cmdOpt.isPresent()) return ResponseEntity.notFound().build();
            CommandeClient cmd = cmdOpt.get();
            int montant = request.getMontant() != null ? request.getMontant() : 0;
            logger.info("Paiement client incoming: commandeId={}, montant={}", id, montant);
            // Permission check: require PAIEMENT_CREER or SUPERADMIN
            org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null || authentication.getName() == null) {
                return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
            }
            com.smboutique.api.model.Utilisateur current = utilisateurService.findByEmail(authentication.getName()).orElse(null);
            boolean isSuperAdmin = current != null && current.getRoles() != null && current.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
            if (!isSuperAdmin && (current == null || !utilisateurService.hasPermission(current, "PAIEMENT_CREER"))) {
                logger.warn("Unauthorized payment creation attempt by {} for commandeId={}", authentication.getName(), id);
                return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé : permission PAIEMENT_CREER requise."));
            }

            Integer paieExistante = cmd.getPaie() != null ? cmd.getPaie() : 0;
            Integer totalCommande = cmd.getTotal() != null ? cmd.getTotal() : 0;
            if (montant <= 0) return ResponseEntity.badRequest().body(java.util.Map.of("error", "Montant invalide"));
            if (paieExistante + montant > totalCommande) return ResponseEntity.badRequest().body(java.util.Map.of("error", "Montant dépasse le total de la commande"));

            // Persist a PaiementClient record for historization
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

            // Enforce a caisse reference: payment must go to a caisse (transactional requirement)
            if (request.getReferenceCaisse() == null || request.getReferenceCaisse().trim().isEmpty()) {
                return ResponseEntity.badRequest().body(java.util.Map.of("error", "Référence de caisse requise. Veuillez créer et ouvrir une caisse pour la boutique avant d'enregistrer un paiement."));
            }

            String refC = request.getReferenceCaisse().trim();
            // Prefer boutique-scoped lookup to avoid NonUniqueResultException
            Long boutiqueIdForSearch = cmd.getBoutique() != null ? cmd.getBoutique().getId() : null;
            java.util.Optional<com.smboutique.api.model.Caisse> maybeCaisseByRef;
            if (boutiqueIdForSearch != null) {
                maybeCaisseByRef = caisseRepository.findFirstByReferenceAndBoutiqueIdOrderByIdDesc(refC, boutiqueIdForSearch);
            } else {
                // If commande has no boutique (defensive), try to resolve unambiguously
                java.util.List<com.smboutique.api.model.Caisse> allWithRef = caisseRepository.findAllByReference(refC);
                if (allWithRef.size() == 1) {
                    maybeCaisseByRef = java.util.Optional.of(allWithRef.get(0));
                } else if (allWithRef.size() > 1) {
                    logger.warn("Reference de caisse ambigue ({}). {} caisses trouvées. CommandeId={}", refC, allWithRef.size(), cmd.getId());
                    return ResponseEntity.badRequest().body(java.util.Map.of("error", "Référence de caisse ambiguë. Plusieurs caisses partagent ce numéro — contactez l'administrateur pour dédoublonner ou spécifier la bonne caisse."));
                } else {
                    maybeCaisseByRef = java.util.Optional.empty();
                }
            }

            if (maybeCaisseByRef.isEmpty()) {
                // Fallback: check if multiple caisses exist with same reference to provide a helpful error
                java.util.List<com.smboutique.api.model.Caisse> allWithRef = caisseRepository.findAllByReference(refC);
                if (allWithRef.size() > 1) {
                    logger.warn("Reference de caisse ambigue ({}). {} caisses trouvées. CommandeId={}", refC, allWithRef.size(), cmd.getId());
                    return ResponseEntity.badRequest().body(java.util.Map.of("error", "Référence de caisse ambiguë. Plusieurs caisses partagent ce numéro — contactez l'administrateur pour dédoublonner ou spécifier la bonne caisse."));
                }
                return ResponseEntity.badRequest().body(java.util.Map.of("error", "Caisse introuvable pour la référence fournie."));
            }
            com.smboutique.api.model.Caisse caisseByRef = maybeCaisseByRef.get();
            if (cmd.getBoutique() == null || caisseByRef.getBoutique() == null || !caisseByRef.getBoutique().getId().equals(cmd.getBoutique().getId())) {
                return ResponseEntity.status(403).body(java.util.Map.of("error", "La caisse sélectionnée n'appartient pas à la boutique de la commande."));
            }
            String sRef = caisseByRef.getStatut() == null ? "" : caisseByRef.getStatut().toUpperCase();
            if (!(sRef.contains("OUVERTE") || sRef.contains("OPEN") || sRef.contains("ACT"))) {
                return ResponseEntity.badRequest().body(java.util.Map.of("error", "La caisse sélectionnée n'est pas ouverte. Ouvrez la caisse avant d'enregistrer des paiements."));
            }

            paiement.setReferenceCaisse(refC);
            paiement.setCommandeClient(cmd);

            // Save paiement via service first so we have an id for the transaction
            com.smboutique.api.model.PaiementClient savedPaiement = paiementClientService.save(paiement);

            // Update caisse montantTotal and create a transaction CREDIT using the provided reference
            com.smboutique.api.model.Caisse caisse = caisseByRef;
            Integer cur = caisse.getMontantTotal() != null ? caisse.getMontantTotal() : 0;
            Integer before = cur;
            caisse.setMontantTotal(cur + montant);
            caisse = caisseService.save(caisse);

            // record simplified transaction
            com.smboutique.api.model.CaisseTransaction tx = new com.smboutique.api.model.CaisseTransaction();
            tx.setType(com.smboutique.api.model.CaisseTransaction.TransactionType.CREDIT);
            tx.setMontant(montant);
            tx.setPaiementId(savedPaiement.getId());
            tx.setCommandeId(cmd.getId());
            try {
                org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                if (auth != null && auth.getName() != null) {
                    com.smboutique.api.model.Utilisateur u = utilisateurService.findByEmail(auth.getName()).orElse(null);
                    if (u != null) tx.setUserId(u.getId());
                }
            } catch (Exception ux) {}
            tx.setReferenceCaisse(refC);
            tx.setBoutiqueId(cmd.getBoutique() != null ? cmd.getBoutique().getId() : null);
            tx.setRaison(request.getReference() != null ? request.getReference() : "Paiement commande client");
            caisseTransactionService.save(tx);

            // record detailed movement for audit
            com.smboutique.api.model.CaisseMovement mv = new com.smboutique.api.model.CaisseMovement();
            mv.setType(com.smboutique.api.model.CaisseMovement.MovementType.CREDIT);
            mv.setMontant(montant);
            mv.setBalanceBefore(before);
            mv.setBalanceAfter(caisse.getMontantTotal());
            mv.setPaiementId(savedPaiement.getId());
            mv.setCommandeId(cmd.getId());
            mv.setUserId(tx.getUserId());
            mv.setReferenceCaisse(refC);
            mv.setBoutiqueId(cmd.getBoutique() != null ? cmd.getBoutique().getId() : null);
            mv.setRaison(request.getReference() != null ? request.getReference() : "Paiement commande client");
            caisseMovementService.save(mv);

            // update commande paie and persist (transactional scope - will commit with above)
            cmd.setPaie(paieExistante + montant);
            com.smboutique.api.model.CommandeClient savedCmd = commandeClientService.save(cmd);

            ResponseEntity.BodyBuilder builder = ResponseEntity.ok();
            builder.header("X-Caisse-Updated", String.valueOf(true));
            builder.header("X-Caisse-Total", String.valueOf(caisse.getMontantTotal()));
            return builder.body(savedCmd);
        } catch (org.springframework.dao.DataAccessException ex) {
            logger.error("Erreur DAO lors de l'enregistrement du paiement ou de la mise à jour de la caisse: {}", ex.getMessage(), ex);
            // Ensure transaction is marked for rollback
            try { org.springframework.transaction.interceptor.TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Exception t) { /* ignore */ }
            // If the root cause is a NonUniqueResultException, return a helpful 400 explaining duplicate caisse references
            Throwable root = org.apache.commons.lang3.exception.ExceptionUtils.getRootCause(ex);
            if (root != null && root.getClass().getName().contains("NonUniqueResultException")) {
                logger.warn("Detected NonUniqueResultException while saving payment — likely duplicate caisse references. CommandeId={}", id);
                return ResponseEntity.badRequest().body(java.util.Map.of("error", "Référence de caisse ambiguë. Plusieurs caisses partagent ce numéro — contactez l'administrateur pour dédoublonner ou spécifier la bonne caisse."));
            }
            return ResponseEntity.status(500).body(java.util.Map.of("error", "Erreur serveur lors de l'enregistrement du paiement. Aucune modification n'a été appliquée."));
        } catch (RuntimeException ex) {
            logger.error("Erreur runtime lors de l'enregistrement du paiement ou de la mise à jour de la caisse: {}", ex.getMessage(), ex);
            try { org.springframework.transaction.interceptor.TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Exception t) { /* ignore */ }
            return ResponseEntity.status(500).body(java.util.Map.of("error", "Erreur serveur lors de l'enregistrement du paiement. Aucune modification n'a été appliquée."));
        } catch (Exception ex) {
            logger.error("Erreur inattendue lors de l'enregistrement du paiement: {}", ex.getMessage(), ex);
            try { org.springframework.transaction.interceptor.TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Exception t) { /* ignore */ }
            return ResponseEntity.status(500).body(java.util.Map.of("error", "Erreur interne"));
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
        private String referenceCaisse;
        public String getReferenceCaisse() { return referenceCaisse; }
        public void setReferenceCaisse(String referenceCaisse) { this.referenceCaisse = referenceCaisse; }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCommandeClient(@PathVariable Long id) {
        return commandeClientService.findById(id)
                .map(commandeClient -> {
                    // Permission check: require COMMANDE_SUPPRIMER or SUPERADMIN
                    org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                    if (authentication == null || authentication.getName() == null) {
                        return ResponseEntity.status(403).<Void>build();
                    }
                    com.smboutique.api.model.Utilisateur user = utilisateurService.findByEmail(authentication.getName()).orElse(null);
                    if (user == null) return ResponseEntity.status(403).<Void>build();
                    boolean isSuper = user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
                    if (!isSuper && !utilisateurService.hasPermission(user, "COMMANDE_SUPPRIMER")) {
                        return ResponseEntity.status(403).<Void>build();
                    }

                    // Annul and revert payments related to this commande (if not already annulled)
                    try {
                        java.util.List<com.smboutique.api.model.PaiementClient> paiements = paiementClientService.findByCommandeClientId(commandeClient.getId());
                        int totalReverted = 0;
                        for (com.smboutique.api.model.PaiementClient p : paiements) {
                            if (p.getAnnule() != null && p.getAnnule()) continue;
                            int montant = p.getMontantPaye() != null ? p.getMontantPaye() : 0;

                            try {
                                p.setAnnule(true);
                                p.setAnnuleAt(java.time.LocalDateTime.now());
                                p.setAnnulePar(user.getId());
                                p.setAnnuleReason("Annulation automatique lors de suppression commande");
                                paiementClientService.save(p);
                            } catch (Exception ex) {
                                // ignore individual payment save errors
                            }

                            // revert caisse if payment was recorded against a caisse reference
                            try {
                                String refC = p.getReferenceCaisse();
                                if (refC != null && !refC.trim().isEmpty()) {
                                    java.util.Optional<com.smboutique.api.model.Caisse> maybeC = caisseRepository.findByReference(refC);
                                    if (maybeC.isPresent()) {
                                        com.smboutique.api.model.Caisse caisse = maybeC.get();
                                        Integer cur = caisse.getMontantTotal() != null ? caisse.getMontantTotal() : 0;
                                        Integer before = cur;
                                        caisse.setMontantTotal(Math.max(0, cur - montant));
                                        caisseService.save(caisse);

                                        try {
                                            com.smboutique.api.model.CaisseTransaction tx = new com.smboutique.api.model.CaisseTransaction();
                                            tx.setType(com.smboutique.api.model.CaisseTransaction.TransactionType.REVERSAL);
                                            tx.setMontant(montant);
                                            tx.setPaiementId(p.getId());
                                            tx.setCommandeId(commandeClient.getId());
                                            tx.setUserId(user.getId());
                                            tx.setReferenceCaisse(refC);
                                            tx.setBoutiqueId(commandeClient.getBoutique() != null ? commandeClient.getBoutique().getId() : null);
                                            tx.setRaison("Annulation commande supprimée");
                                            caisseTransactionService.save(tx);
                                        } catch (Exception txe) {
                                            // ignore tx errors
                                        }

                                        // record detailed movement REVERSAL
                                        try {
                                            com.smboutique.api.model.CaisseMovement mv = new com.smboutique.api.model.CaisseMovement();
                                            mv.setType(com.smboutique.api.model.CaisseMovement.MovementType.REVERSAL);
                                            mv.setMontant(montant);
                                            mv.setBalanceBefore(before);
                                            mv.setBalanceAfter(caisse.getMontantTotal());
                                            mv.setPaiementId(p.getId());
                                            mv.setCommandeId(commandeClient.getId());
                                            mv.setUserId(user.getId());
                                            mv.setReferenceCaisse(refC);
                                            mv.setBoutiqueId(commandeClient.getBoutique() != null ? commandeClient.getBoutique().getId() : null);
                                            mv.setRaison("Annulation commande supprimée");
                                            caisseMovementService.save(mv);
                                        } catch (Exception mvex) {
                                            // ignore movement errors
                                        }
                                    }
                                }
                            } catch (Exception inner) {
                                // ignore per-payment reversal errors
                            }

                            totalReverted += montant;
                        }

                        // Update commande paie to reflect annulled payments before deletion (safety)
                        Integer currentPaie = commandeClient.getPaie() != null ? commandeClient.getPaie() : 0;
                        commandeClient.setPaie(Math.max(0, currentPaie - totalReverted));
                        commandeClientService.save(commandeClient);
                    } catch (Exception ex) {
                        org.slf4j.LoggerFactory.getLogger(CommandeClientController.class).warn("Error while annulling payments during commande delete: {}", ex.getMessage());
                    }

                    // Finally delete the commande
                    commandeClientService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
