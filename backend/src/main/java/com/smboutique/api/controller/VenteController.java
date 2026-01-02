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

    @PostMapping
    public ResponseEntity<Vente> createVente(@RequestBody Vente vente) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "VENTE_CREER") && !isSuperAdmin(user)) {
            return ResponseEntity.status(403).build();
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
        public Integer prix;
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
                try {
                    parsedDateCommande = java.time.LocalDateTime.parse(request.dateVente);
                } catch (java.time.format.DateTimeParseException ex1) {
                    try {
                        parsedDateCommande = java.time.OffsetDateTime.parse(request.dateVente).toLocalDateTime();
                    } catch (java.time.format.DateTimeParseException ex2) {
                        return ResponseEntity.badRequest().body(java.util.Map.of("error", "Date de commande invalide"));
                    }
                }
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

            // set utilisateur (authenticated user) who created this commande
            if (user != null) {
                cc.setUtilisateur(user);
            }

            java.util.List<LigneCommandeClient> lignes = new java.util.ArrayList<>();
            for (VenteLineRequest pl : request.produitsSelectionnes) {
                com.smboutique.api.model.Stock s = stockRepository.findById(pl.id_stock).orElseThrow(() -> new RuntimeException("Stock introuvable"));
                LigneCommandeClient lcc = new LigneCommandeClient();

                int quantiteReelle = 0;
                if (pl.venteParConditionnement != null && pl.venteParConditionnement) {
                    Integer mul = s.getProduit().getNombreUnitesParConditionnement();
                    quantiteReelle = pl.quantiteConditionnement * mul;
                } else {
                    quantiteReelle = pl.quantite == null ? 0 : pl.quantite;
                }

                lcc.setProduit(s.getProduit());
                lcc.setQuantite(quantiteReelle);
                lcc.setQuantiteLivre(0);
                lcc.setNewPrice(pl.prix == null ? 0 : pl.prix);
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
        public Integer prix;
        public String priceMode; // DETAIL or GROS
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

            // find active caisse for boutique
            java.util.Optional<com.smboutique.api.model.Caisse> maybeCaisse = caisseRepository.findFirstByBoutiqueIdOrderByIdDesc(boutiqueId);
            if (maybeCaisse.isEmpty()) return ResponseEntity.badRequest().body(java.util.Map.of("error", "Aucune caisse active pour la boutique"));
            com.smboutique.api.model.Caisse caisse = maybeCaisse.get();
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
            for (CashLineRequest pl : request.produitsSelectionnes) {
                com.smboutique.api.model.Stock s = stockRepository.findById(pl.id_stock)
                        .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Stock introuvable"));

                // Business rule: forbid selling from a magasin-level stock
                if (s.getMagasin() != null) {
                    throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Vente depuis un stock magasin interdite. Utilisez le stock boutique ou transférez d'abord les quantités.");
                }

                int quantiteReelle = 0;
                if (pl.venteParConditionnement != null && pl.venteParConditionnement) {
                    Integer mul = s.getProduit().getNombreUnitesParConditionnement() == null ? 1 : s.getProduit().getNombreUnitesParConditionnement();
                    quantiteReelle = (pl.quantiteConditionnement == null ? 0 : pl.quantiteConditionnement) * mul;
                } else {
                    quantiteReelle = pl.quantite == null ? 0 : pl.quantite;
                }

                if (s.getQuantiteDisponible() == null || s.getQuantiteDisponible() < quantiteReelle) {
                    throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Stock insuffisant pour produit " + s.getProduit().getNomProduit());
                }
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
                        parsedDateVente = java.time.OffsetDateTime.parse(request.dateVente).toLocalDateTime();
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
            v = venteService.save(v);

            // For each line create LigneVente, decrement stock and create Mouvement
            for (CashLineRequest pl : request.produitsSelectionnes) {
                com.smboutique.api.model.Stock s = stockRepository.findById(pl.id_stock).orElseThrow();

                // Business rule: forbid selling from a magasin-level stock
                if (s.getMagasin() != null) {
                    throw new RuntimeException("Vente depuis un stock magasin interdite. Utilisez le stock boutique ou transférez d'abord les quantités.");
                }

                int quantiteReelle = 0;
                if (pl.venteParConditionnement != null && pl.venteParConditionnement) {
                    Integer mul = s.getProduit().getNombreUnitesParConditionnement() == null ? 1 : s.getProduit().getNombreUnitesParConditionnement();
                    quantiteReelle = (pl.quantiteConditionnement == null ? 0 : pl.quantiteConditionnement) * mul;
                } else {
                    quantiteReelle = pl.quantite == null ? 0 : pl.quantite;
                }

                LigneVente lv = new LigneVente();
                lv.setVente(v);
                lv.setProduit(s.getProduit());
                lv.setQuantite(quantiteReelle);
                lv.setQuantiteLivre(quantiteReelle);
                lv.setNewPrice(pl.prix == null ? 0 : pl.prix);
                if (pl.priceMode != null) {
                    try { lv.setPriceMode(com.smboutique.api.model.PriceMode.valueOf(pl.priceMode)); } catch (Exception e) { }
                }
                ligneVenteService.save(lv);

                // decrement stock
                Integer cur = s.getQuantiteDisponible() == null ? 0 : s.getQuantiteDisponible();
                s.setQuantiteDisponible(cur - quantiteReelle);
                stockRepository.save(s);

                // create mouvement
                com.smboutique.api.model.Mouvement mv = new com.smboutique.api.model.Mouvement();
                mv.setLigneVente(lv);
                mv.setProduit(s.getProduit());
                mv.setStock(s);
                mv.setBoutique(user.getBoutique());
                mv.setQuantite(quantiteReelle);
                mv.setTypeMouvement("SORTIE");
                mv.setMontant((pl.prix == null ? 0 : pl.prix) * quantiteReelle);
                mv.setDateMouvement(java.time.LocalDateTime.now());
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
}
