package com.smboutique.api.controller;

import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.model.Vente;
import com.smboutique.api.model.LigneVente;
import com.smboutique.api.model.CommandeClient;
import com.smboutique.api.model.LigneCommandeClient;
import com.smboutique.api.service.VenteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@RestController
@RequestMapping("/api/ventes")
@CrossOrigin(origins = "*")
public class VenteController {

    @Autowired
    private VenteService venteService;

    @Autowired
    private com.smboutique.api.service.LigneVenteService ligneVenteService;

    @Autowired
    private com.smboutique.api.repository.StockRepository stockRepository;

    @Autowired
    private com.smboutique.api.service.InventaireService inventaireService;

    @Autowired
    private com.smboutique.api.service.UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.repository.ClientGrossisteRepository clientGrossisteRepository;

    @Autowired
    private com.smboutique.api.service.CommandeClientService commandeClientService;

    @Autowired
    private com.smboutique.api.service.LigneCommandeClientService ligneCommandeClientService;

    @Autowired
    private com.smboutique.api.repository.CaisseRepository caisseRepository;

    @Autowired
    private com.smboutique.api.service.CaisseService caisseService;

    @Autowired
    private com.smboutique.api.service.CaisseTransactionService caisseTransactionService;

    @Autowired
    private com.smboutique.api.service.CaisseMovementService caisseMovementService;

    @Autowired
    private com.smboutique.api.service.MouvementService mouvementService;

    @Autowired
    private com.smboutique.api.service.PdfService pdfService;

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
        // Determine superadmin by role membership only
        return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
    }

    private boolean hasPermission(com.smboutique.api.model.Utilisateur user, String permissionName) {
        if (user == null) return false;
        return user.getPermissions().stream().anyMatch(p -> p.getName().equals(permissionName));
    }

    // Parse a flexible set of datetime formats and preserve client's wall time when an offset is present
    private java.time.LocalDateTime parseToLocalDateTime(String dt) {
        if (dt == null) return null;
        try {
            return java.time.OffsetDateTime.parse(dt).toLocalDateTime();
        } catch (Exception ignored) {}
        try {
            java.time.format.DateTimeFormatter formatter = new java.time.format.DateTimeFormatterBuilder()
                    .appendPattern("yyyy-MM-dd'T'HH:mm")
                    .optionalStart().appendPattern(":ss").optionalEnd()
                    .optionalStart().appendOffset("ZZZZZ","Z").optionalEnd()
                    .toFormatter();
            java.time.temporal.TemporalAccessor ta = formatter.parse(dt);
            if (ta.isSupported(java.time.temporal.ChronoField.OFFSET_SECONDS)) {
                return java.time.OffsetDateTime.from(ta).toLocalDateTime();
            } else {
                return java.time.LocalDateTime.from(ta);
            }
        } catch (Exception ignored) {}

        try { return java.time.LocalDateTime.parse(dt); } catch(Exception ignored) {}
        try { java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"); return java.time.LocalDateTime.parse(dt.replace('T',' '), fmt); } catch(Exception ignored) {}
        return null;
    }

    @GetMapping
    public List<Vente> getAllVentes() {
        return venteService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Vente> getVenteById(@PathVariable Long id) {
        return venteService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/lignes")
    public ResponseEntity<java.util.List<com.smboutique.api.model.LigneVente>> getLignesByVenteId(@PathVariable Long id) {
        try {
            java.util.List<com.smboutique.api.model.LigneVente> lignes = ligneVenteService.findAll();
            java.util.List<com.smboutique.api.model.LigneVente> filtered = new java.util.ArrayList<>();
            if (lignes != null) {
                for (com.smboutique.api.model.LigneVente lv : lignes) {
                    if (lv.getVente() != null && lv.getVente().getId() != null && lv.getVente().getId().equals(id)) filtered.add(lv);
                }
            }
            return ResponseEntity.ok(filtered);
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    @PostMapping
    public ResponseEntity<Vente> createVente(@RequestBody Vente vente) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "VENTE_CREER") && !isSuperAdmin(user)) {
            return ResponseEntity.status(403).build();
        }
        // Ensure we record the creating user and boutique for audit and filtering
        if (vente.getUtilisateur() == null && user != null) {
            vente.setUtilisateur(user);
        }
        if (vente.getBoutique() == null && user != null && user.getBoutique() != null) {
            vente.setBoutique(user.getBoutique());
        }
        return ResponseEntity.ok(venteService.save(vente));
    }

    // Create a Vente with its lignes (used by frontend sale flow)
    public static class VenteLineRequest {
        public Long id_stock;
        // If venteParConditionnement is true, quantiteConditionnement represents the number of conditionnements.
        // Otherwise, quantite represents the number of units.
        public Integer quantite;
        public Boolean venteParConditionnement;
        public Integer quantiteConditionnement;
        public Long id_emballage; // which emballage (carton, sac...) was ordered; required only when the product has 2+
        public Integer prix;
        public Integer prixRevendeur; // optionnel : prix affiché sur le reçu (option revendeur) ; n'affecte pas le prix réel
        public String priceMode; // DETAIL or GROS
    }

    public static class VenteFullRequest {
        public String reference;
        public String dateVente;
        public String nomClient;
        public java.util.Map<String, Object> client; // frontend may send { "id": 12 }
        public java.util.List<VenteLineRequest> produitsSelectionnes = new java.util.ArrayList<>();
        public Integer total;
    }

    @PostMapping("/full")
    @Transactional
    public ResponseEntity<?> createVenteFull(@RequestBody VenteFullRequest request) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "VENTE_CREER") && !isSuperAdmin(user)) {
            return ResponseEntity.status(403).body("Permission refusée");
        }

        try {
            // Note: do not validate or decrement stock at vente creation time.
            // Stock availability and decrement will be handled at delivery time (livraison). 
            // Persist CommandeClient and lignes (quantite saved as quantite_reelle)
            CommandeClient cc = new CommandeClient();
            cc.setReference(request.reference);
            // Parse dateVente: accept LocalDateTime and OffsetDateTime (with trailing Z)
            java.time.LocalDateTime parsedDateCommande;
            if (request.dateVente == null) {
                parsedDateCommande = java.time.LocalDateTime.now();
            } else {
                java.time.LocalDateTime p = parseToLocalDateTime(request.dateVente);
                if (p == null) return ResponseEntity.badRequest().body(java.util.Map.of("error", "Date de commande invalide"));
                parsedDateCommande = p;
            }
            cc.setDateCommande(parsedDateCommande);
            cc.setTotal(request.total == null ? 0 : request.total);
            cc.setPaie(0);

            // set client if provided
            if (request.client != null && request.client.get("id") != null) {
                Long cid = Long.parseLong(String.valueOf(request.client.get("id")));
                com.smboutique.api.model.ClientGrossiste clientEntity = clientGrossisteRepository.findById(cid).orElse(null);
                if (clientEntity != null) {
                    cc.setClient(clientEntity);
                }
            }

            // set boutique from current user if available
            if (user != null && user.getBoutique() != null) {
                cc.setBoutique(user.getBoutique());
            }

            // Block creation of orders when an active inventory exists
            if (cc.getBoutique() != null && inventaireService.existsActiveInventoryForBoutique(cc.getBoutique().getId())) {
                return ResponseEntity.status(409).body(java.util.Map.of("code", "INVENTAIRE_ACTIVE", "message", "Opération bloquée : inventaire actif pour cette boutique"));
            }

            // set utilisateur (authenticated user) who created this commande
            if (user != null) {
                cc.setUtilisateur(user);
            }

            // Option "revendeur" de la boutique : autorise la saisie d'un prix revendeur (reçu).
            boolean optionRevendeur = user != null && user.getBoutique() != null
                    && Boolean.TRUE.equals(user.getBoutique().getOptionRevendeur());

            java.util.List<LigneCommandeClient> lignes = new java.util.ArrayList<>();
            long computedTotal = 0;
            for (VenteLineRequest pl : request.produitsSelectionnes) {
                com.smboutique.api.model.Stock s = stockRepository.findById(pl.id_stock).orElseThrow(() -> new RuntimeException("Stock introuvable"));
                LigneCommandeClient lcc = new LigneCommandeClient();

                int quantiteReelle = 0;
                com.smboutique.api.model.ProduitEmballage chosenEmballageCC = null;
                if (pl.venteParConditionnement != null && pl.venteParConditionnement) {
                    chosenEmballageCC = resolveEmballage(pl.id_emballage, s);
                    Integer mul = chosenEmballageCC != null
                            ? chosenEmballageCC.getNombreUnites()
                            : (s.getProduit().getNombreUnitesParConditionnement() == null ? 1 : s.getProduit().getNombreUnitesParConditionnement());
                    quantiteReelle = pl.quantiteConditionnement * mul;
                } else {
                    quantiteReelle = pl.quantite == null ? 0 : pl.quantite;
                }

                if (pl.prix == null || pl.prix < 0) {
                    return ResponseEntity.badRequest().body(java.util.Map.of("error", "Prix invalide pour produit " + s.getProduit().getNomProduit()));
                }
                // Same tariff check as createVenteCash: the submitted price must match the
                // product's configured gros/détail price (or prixAchat if that tier is unset).
                boolean isGrosFull = "GROS".equalsIgnoreCase(pl.priceMode);
                Integer expectedPriceFull = isGrosFull
                        ? (s.getProduit().getPrixEnGros() != null ? s.getProduit().getPrixEnGros() : s.getProduit().getPrixAchat())
                        : (s.getProduit().getPrixDetail() != null ? s.getProduit().getPrixDetail() : s.getProduit().getPrixAchat());
                if (expectedPriceFull == null || !expectedPriceFull.equals(pl.prix)) {
                    return ResponseEntity.badRequest().body(java.util.Map.of("error",
                            "Le prix soumis (" + pl.prix + ") ne correspond pas au prix " + (isGrosFull ? "gros" : "détail") + " configuré pour " + s.getProduit().getNomProduit()));
                }
                computedTotal += (long) pl.prix * quantiteReelle;

                lcc.setProduit(s.getProduit());
                lcc.setQuantite(quantiteReelle);
                lcc.setQuantiteConditionnement(pl.quantiteConditionnement);
                lcc.setEmballage(chosenEmballageCC);
                lcc.setQuantiteLivre(0);
                lcc.setNewPrice(pl.prix == null ? 0 : pl.prix);
                // Prix revendeur (reçu) : uniquement si l'option est active. N'affecte pas newPrice ni les totaux réels.
                if (optionRevendeur && pl.prixRevendeur != null && pl.prixRevendeur >= 0) {
                    lcc.setPrixRevendeur(pl.prixRevendeur);
                }
                // set price mode if provided
                if (pl.priceMode != null) {
                    try {
                        lcc.setPriceMode(com.smboutique.api.model.PriceMode.valueOf(pl.priceMode));
                    } catch (Exception e) {
                        // ignore invalid value
                    }
                }
                lcc.setCommandeClient(cc);
                lignes.add(lcc);

                // Inventory will be updated on delivery (livraison), not at sale creation.
            }

            // Never trust the client-submitted total blindly (see the same fix in createVenteCash):
            // it must equal the sum of the lines, otherwise the amount owed by the client would be
            // disconnected from what was actually ordered.
            long clientTotal = request.total == null ? 0 : request.total;
            if (computedTotal != clientTotal) {
                return ResponseEntity.badRequest().body(java.util.Map.of("error",
                        "Le montant total (" + clientTotal + ") ne correspond pas à la somme des lignes commandées (" + computedTotal + ")"));
            }

            cc.setLignes(lignes);
            CommandeClient saved = commandeClientService.save(cc);

            return ResponseEntity.ok(saved);
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(ex.getMessage());
        }
    }

    // Request DTOs for cash sale
    public static class CashLineRequest {
        public Long id_stock;
        public Integer quantite; // units or number of conditionnements depending on venteParConditionnement
        public Boolean venteParConditionnement;
        public Integer quantiteConditionnement;
        public Long id_emballage; // which emballage (carton, sac...) was sold; required only when the product has 2+
        public Integer prix;
        public Integer prixRevendeur; // optionnel : prix affiché sur le reçu (option revendeur) ; n'affecte pas le prix réel
        public String priceMode; // DETAIL or GROS
    }

    @Autowired
    private com.smboutique.api.repository.ProduitEmballageRepository produitEmballageRepository;

    // Resolves which emballage a conditionnement-based cash sale line refers to, validating it
    // belongs to the sold product and requiring disambiguation when the product has more than
    // one. Returns null when the product has 0 or 1 emballage, meaning callers should fall back
    // to the legacy flat Produit.nombreUnitesParConditionnement field (unchanged behavior).
    private com.smboutique.api.model.ProduitEmballage resolveEmballage(CashLineRequest pl, com.smboutique.api.model.Stock s) {
        return resolveEmballage(pl.id_emballage, s);
    }

    private com.smboutique.api.model.ProduitEmballage resolveEmballage(Long idEmballage, com.smboutique.api.model.Stock s) {
        if (idEmballage != null) {
            com.smboutique.api.model.ProduitEmballage emb = produitEmballageRepository.findById(idEmballage)
                    .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Emballage introuvable"));
            if (!emb.getProduit().getId().equals(s.getProduit().getId())) {
                throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,
                        "Cet emballage n'appartient pas au produit " + s.getProduit().getNomProduit());
            }
            return emb;
        }
        java.util.List<com.smboutique.api.model.ProduitEmballage> all = produitEmballageRepository.findByProduitId(s.getProduit().getId());
        if (all.size() > 1) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Veuillez préciser l'emballage vendu pour " + s.getProduit().getNomProduit());
        }
        return null;
    }

    public static class VenteCashRequest {
        public String reference;
        public String dateVente;
        public String nomClient;
        public Integer total;
        public Integer montantRecu;
        public Integer monnaieRembourse;
        public Integer remise;
        public java.util.List<CashLineRequest> produitsSelectionnes = new java.util.ArrayList<>();
    }

    @PostMapping("/cash")
    @Transactional
    public ResponseEntity<?> createVenteCash(@RequestBody VenteCashRequest request) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "VENTE_CREER") && !isSuperAdmin(user)) {
            return ResponseEntity.status(403).body("Permission refusée");
        }

        if (request == null || request.produitsSelectionnes == null || request.produitsSelectionnes.isEmpty()) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "Aucun produit sélectionné"));
        }

        try {
            Long boutiqueId = user != null && user.getBoutique() != null ? user.getBoutique().getId() : null;
            if (boutiqueId == null) return ResponseEntity.badRequest().body(java.util.Map.of("error", "Boutique introuvable pour l'utilisateur"));

            // Option "revendeur" de la boutique : autorise la saisie d'un prix revendeur (reçu).
            boolean optionRevendeur = user.getBoutique() != null && Boolean.TRUE.equals(user.getBoutique().getOptionRevendeur());

            // Block ventes when an active inventory exists for this boutique
            if (inventaireService.existsActiveInventoryForBoutique(boutiqueId)) {
                return ResponseEntity.status(409).body(java.util.Map.of("code", "INVENTAIRE_ACTIVE", "message", "Opération bloquée : inventaire actif pour cette boutique"));
            }

            // find active caisse for boutique
            java.util.Optional<com.smboutique.api.model.Caisse> maybeCaisse = caisseRepository.findFirstByBoutiqueIdOrderByIdDesc(boutiqueId);
            if (maybeCaisse.isEmpty()) return ResponseEntity.badRequest().body(java.util.Map.of("error", "Aucune caisse active pour la boutique"));
            com.smboutique.api.model.Caisse caisse = maybeCaisse.get();
            // Lock caisse row to prevent lost updates on montantTotal
            caisse = caisseRepository.findByIdForUpdate(caisse.getId()).orElse(caisse);
            // Accept several representations of an "open" status (front historically uses 'OUVERTE')
            String statut = caisse.getStatut();
            boolean isOpen = false;
            if (statut != null) {
                String s = statut.trim().toLowerCase();
                isOpen = "on".equalsIgnoreCase(s) || "ouverte".equalsIgnoreCase(s) || "ouvert".equalsIgnoreCase(s) || s.contains("ouvert") || "open".equalsIgnoreCase(s);
            }
            if (!isOpen) {
                return ResponseEntity.badRequest().body(java.util.Map.of("error", "La caisse active n'est pas ouverte"));
            }

            // Validate stock availability before any change
            long computedTotal = 0;
            for (CashLineRequest pl : request.produitsSelectionnes) {
                com.smboutique.api.model.Stock s = stockRepository.findById(pl.id_stock)
                        .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Stock introuvable"));

                // Business rule: forbid selling from a magasin-level stock
                if (s.getMagasin() != null) {
                    throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Vente depuis un stock magasin interdite. Utilisez le stock boutique ou transférez d'abord les quantités.");
                }

                int quantiteReelle = 0;
                if (pl.venteParConditionnement != null && pl.venteParConditionnement) {
                    com.smboutique.api.model.ProduitEmballage chosenEmballage = resolveEmballage(pl, s);
                    Integer mul = chosenEmballage != null
                            ? chosenEmballage.getNombreUnites()
                            : (s.getProduit().getNombreUnitesParConditionnement() == null ? 1 : s.getProduit().getNombreUnitesParConditionnement());
                    // Validation rules for conditionnement-based sale
                    if (mul == null || mul <= 1) {
                        throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Conditionnement non autorisé pour produit " + s.getProduit().getNomProduit());
                    }
                    if (pl.quantiteConditionnement == null || pl.quantiteConditionnement < 1) {
                        throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Quantité de conditionnements invalide pour produit " + s.getProduit().getNomProduit());
                    }
                    int totalOpenUnits = pl.quantiteConditionnement * mul;
                    if (pl.quantite != null) {
                        if (pl.quantite <= 0 || pl.quantite > totalOpenUnits) {
                            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Quantité vendue invalide pour produit " + s.getProduit().getNomProduit());
                        }
                        quantiteReelle = pl.quantite;
                    } else {
                        // full conditionnement sale when quantite not specified
                        quantiteReelle = totalOpenUnits;
                    }
                } else {
                    if (pl.quantite == null || pl.quantite <= 0) {
                        throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Quantité invalide pour produit " + s.getProduit().getNomProduit());
                    }
                    quantiteReelle = pl.quantite;
                }

                if (s.getQuantiteDisponible() == null || s.getQuantiteDisponible() < quantiteReelle) {
                    throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Stock insuffisant pour produit " + s.getProduit().getNomProduit());
                }

                if (pl.prix == null || pl.prix < 0) {
                    throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Prix invalide pour produit " + s.getProduit().getNomProduit());
                }
                // Never trust a client-submitted price disconnected from the product's real
                // tariff: the honest UI locks this field to the catalog gros/détail price, but a
                // direct API call could otherwise sell at any price. Same fallback chain as the
                // frontend (VenteEnEspece.tsx): prixEnGros/prixDetail, falling back to prixAchat
                // only when the tier itself isn't configured.
                boolean isGrosCash = "GROS".equalsIgnoreCase(pl.priceMode);
                Integer expectedPriceCash = isGrosCash
                        ? (s.getProduit().getPrixEnGros() != null ? s.getProduit().getPrixEnGros() : s.getProduit().getPrixAchat())
                        : (s.getProduit().getPrixDetail() != null ? s.getProduit().getPrixDetail() : s.getProduit().getPrixAchat());
                if (expectedPriceCash == null || !expectedPriceCash.equals(pl.prix)) {
                    throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,
                            "Le prix soumis (" + pl.prix + ") ne correspond pas au prix " + (isGrosCash ? "gros" : "détail") + " configuré pour " + s.getProduit().getNomProduit());
                }
                computedTotal += (long) pl.prix * quantiteReelle;
            }

            // Never trust the client-submitted total blindly: it must equal the sum of the lines,
            // otherwise a crafted request could credit the caisse with an amount disconnected from
            // what was actually sold (till-skimming risk, or an accounting mismatch on a UI bug).
            long clientTotal = request.total == null ? 0 : request.total;
            if (computedTotal != clientTotal) {
                return ResponseEntity.badRequest().body(java.util.Map.of("error",
                        "Le montant total (" + clientTotal + ") ne correspond pas à la somme des lignes vendues (" + computedTotal + ")"));
            }

            // Create Vente
            Vente v = new Vente();
            v.setReferenceCaisse(caisse.getReference());
            // Parse dateVente: accept LocalDateTime and OffsetDateTime (with trailing Z)
            java.time.LocalDateTime parsedDateVente;
            if (request.dateVente == null) {
                parsedDateVente = java.time.LocalDateTime.now();
            } else {
                try {
                    parsedDateVente = java.time.LocalDateTime.parse(request.dateVente);
                } catch (java.time.format.DateTimeParseException ex1) {
                    try {
                        parsedDateVente = java.time.OffsetDateTime.parse(request.dateVente).toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDateTime();
                    } catch (java.time.format.DateTimeParseException ex2) {
                        return ResponseEntity.badRequest().body(java.util.Map.of("error", "Date de vente invalide"));
                    }
                }
            }
            v.setDateVente(parsedDateVente);
            v.setNomClient(request.nomClient != null ? request.nomClient : "Clients divers");
            v.setMontantTotal(request.total == null ? 0 : request.total);
            v.setRemise(request.remise == null ? 0 : request.remise);
            v.setNetAPayer(request.total == null ? 0 : request.total - (request.remise == null ? 0 : request.remise));
            v.setMontantRecu(request.montantRecu == null ? 0 : request.montantRecu);
            v.setMonnaieRembourse(request.monnaieRembourse == null ? 0 : request.monnaieRembourse);
            v.setUtilisateur(user);
            // Ensure boutique is recorded for multi-boutique support
            if (user != null && user.getBoutique() != null) {
                v.setBoutique(user.getBoutique());
            }
            v = venteService.save(v);

            // For each line create LigneVente, decrement stock and create Mouvement
            for (CashLineRequest pl : request.produitsSelectionnes) {
                // Lock stock row to avoid concurrent lost updates on quantiteDisponible
                com.smboutique.api.model.Stock s = stockRepository.findByIdForUpdate(pl.id_stock).orElseThrow();

                // Business rule: forbid selling from a magasin-level stock
                if (s.getMagasin() != null) {
                    throw new RuntimeException("Vente depuis un stock magasin interdite. Utilisez le stock boutique ou transférez d'abord les quantités.");
                }

                int quantiteReelle = 0;
                com.smboutique.api.model.ProduitEmballage chosenEmballage = null;
                Integer mul;
                if (pl.venteParConditionnement != null && pl.venteParConditionnement) {
                    chosenEmballage = resolveEmballage(pl, s);
                    mul = chosenEmballage != null
                            ? chosenEmballage.getNombreUnites()
                            : (s.getProduit().getNombreUnitesParConditionnement() == null ? 1 : s.getProduit().getNombreUnitesParConditionnement());
                    int totalOpenUnits = (pl.quantiteConditionnement == null ? 0 : pl.quantiteConditionnement) * mul;
                    quantiteReelle = pl.quantite == null ? totalOpenUnits : pl.quantite;
                } else {
                    mul = s.getProduit().getNombreUnitesParConditionnement() == null ? 1 : s.getProduit().getNombreUnitesParConditionnement();
                    quantiteReelle = pl.quantite == null ? 0 : pl.quantite;
                }

                LigneVente lv = new LigneVente();
                lv.setVente(v);
                lv.setProduit(s.getProduit());
                lv.setQuantite(quantiteReelle);
                // Only record quantiteConditionnement when sale was issued from a conditionnement
                lv.setQuantiteConditionnement((pl.venteParConditionnement != null && pl.venteParConditionnement) ? pl.quantiteConditionnement : null);
                lv.setEmballage(chosenEmballage);
                lv.setQuantiteLivre(quantiteReelle);
                lv.setNewPrice(pl.prix == null ? 0 : pl.prix);
                // Prix revendeur (reçu) : uniquement si l'option est active. N'affecte pas newPrice ni la caisse.
                if (optionRevendeur && pl.prixRevendeur != null && pl.prixRevendeur >= 0) {
                    lv.setPrixRevendeur(pl.prixRevendeur);
                }
                if (pl.priceMode != null) {
                    try { lv.setPriceMode(com.smboutique.api.model.PriceMode.valueOf(pl.priceMode)); } catch (Exception e) { }
                }

                // Compute remainder after sale for 'open carton' semantics and save on line for history
                Integer cur = s.getQuantiteDisponible() == null ? 0 : s.getQuantiteDisponible();
                if (cur < quantiteReelle) {
                    throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Stock insuffisant pour produit " + s.getProduit().getNomProduit());
                }
                int after = cur - quantiteReelle;
                if (mul != null && mul > 1) {
                    int remAfter = ((after % mul) + mul) % mul; // normalize
                    if (remAfter > 0) lv.setResteUnitesDansCartonApresVente(remAfter);
                    else lv.setResteUnitesDansCartonApresVente(null);
                } else {
                    lv.setResteUnitesDansCartonApresVente(null);
                }

                ligneVenteService.save(lv);

                // decrement stock
                s.setQuantiteDisponible(cur - quantiteReelle);
                stockRepository.save(s);

                // create mouvement (item-level) with audit fields
                com.smboutique.api.model.Mouvement mv = new com.smboutique.api.model.Mouvement();
                mv.setLigneVente(lv);
                mv.setProduit(s.getProduit());
                mv.setStock(s);
                mv.setBoutique(user.getBoutique());
                mv.setQuantite(quantiteReelle);
                mv.setTypeMouvement("SORTIE");
                mv.setMontant((pl.prix == null ? 0 : pl.prix) * quantiteReelle);
                mv.setDateMouvement(java.time.LocalDateTime.now());
                mv.setUtilisateur(user);
                mv.setDescription("Sortie de stock liée à une vente");
                mv.setSousType("ESPECE");
                mv.setReferenceId(v.getId());
                mouvementService.save(mv);
            }

            // update caisse
            Integer montant = request.total == null ? 0 : request.total;
            Integer balanceBefore = caisse.getMontantTotal() == null ? 0 : caisse.getMontantTotal();
            caisse.setMontantTotal(balanceBefore + montant);
            caisse = caisseService.save(caisse);

            // create caisse transaction
            com.smboutique.api.model.CaisseTransaction tx = new com.smboutique.api.model.CaisseTransaction();
            tx.setType(com.smboutique.api.model.CaisseTransaction.TransactionType.CREDIT);
            tx.setMontant(montant);
            tx.setReferenceCaisse(caisse.getReference());
            tx.setUserId(user.getId());
            tx.setBoutiqueId(user.getBoutique() != null ? user.getBoutique().getId() : null);
            caisseTransactionService.save(tx);

            // create caisse movement
            com.smboutique.api.model.CaisseMovement cm = new com.smboutique.api.model.CaisseMovement();
            cm.setType(com.smboutique.api.model.CaisseMovement.MovementType.CREDIT);
            cm.setMontant(montant);
            cm.setBalanceBefore(balanceBefore);
            cm.setBalanceAfter(caisse.getMontantTotal());
            cm.setReferenceCaisse(caisse.getReference());
            cm.setBoutiqueId(user.getBoutique() != null ? user.getBoutique().getId() : null);
            cm.setUserId(user.getId());
            cm.setRaison("Vente comptant");
            caisseMovementService.save(cm);

            // audit-level mouvement
            mouvementService.log("VENTE", "ESPECE", "Vente en espèces enregistrée", v.getId(), user.getBoutique() != null ? user.getBoutique().getId() : null, null, user.getId(), v.getMontantTotal() != null ? Double.valueOf(v.getMontantTotal()) : null);

            return ResponseEntity.ok(v);
        } catch (org.springframework.web.server.ResponseStatusException r) {
            throw r;
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(ex.getMessage());
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Vente> updateVente(@PathVariable Long id, @RequestBody Vente venteDetails) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "VENTE_MODIFIER") && !isSuperAdmin(user)) {
            return ResponseEntity.status(403).build();
        }
        return venteService.findById(id)
                .map(vente -> {
                    vente.setReferenceCaisse(venteDetails.getReferenceCaisse());
                    vente.setDateVente(venteDetails.getDateVente());
                    vente.setMontantTotal(venteDetails.getMontantTotal());
                    vente.setNomClient(venteDetails.getNomClient());
                    return ResponseEntity.ok(venteService.save(vente));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteVente(@PathVariable Long id) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "VENTE_SUPPRIMER") && !isSuperAdmin(user)) {
            return ResponseEntity.status(403).build();
        }
        return venteService.findById(id)
                .map(vente -> {
                    venteService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/pdf")
    public void getVentePdf(@PathVariable Long id, jakarta.servlet.http.HttpServletResponse response) {
        try {
            pdfService.writeVentePdf(id, response);
            try {
                Long userId = null;
                try {
                    var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                    if (auth != null && auth.getName() != null) {
                        var u = utilisateurService.findByEmail(auth.getName()).orElse(null);
                        if (u != null) userId = u.getId();
                    }
                } catch (Exception ignore) {}
                var vopt = venteService.findById(id);
                if (vopt.isPresent()) {
                    var v = vopt.get();
                    Long boutiqueId = v.getBoutique() != null ? v.getBoutique().getId() : null;
                    Double montant = v.getMontantTotal() != null ? Double.valueOf(v.getMontantTotal()) : null;
                    mouvementService.log("DOCUMENT", "VENTE_PDF", "Génération PDF - VENTE", id, boutiqueId, null, userId, montant);
                }
            } catch (Exception ignore) {}
        } catch (Exception e) {
            try { response.sendError(500); } catch (Exception ignored) {}
        }
    }
}
