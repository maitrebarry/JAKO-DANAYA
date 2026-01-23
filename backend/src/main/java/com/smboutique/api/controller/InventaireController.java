package com.smboutique.api.controller;

import com.smboutique.api.model.Inventaire;
import com.smboutique.api.service.InventaireService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/inventaires")
@CrossOrigin(origins = "*")
public class InventaireController {

    @Autowired
    private InventaireService inventaireService;

    @Autowired
    private com.smboutique.api.service.UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.service.LigneInventaireService ligneInventaireService;

    @Autowired
    private com.smboutique.api.repository.LigneInventaireRepository ligneInventaireRepository;

    @Autowired
    private com.smboutique.api.service.PdfService pdfService;

    @Autowired
    private com.smboutique.api.repository.StockRepository stockRepository;

    private com.smboutique.api.model.Utilisateur getCurrentUser() {
        org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("Utilisateur authentifié introuvable");
        }
        return utilisateurService.findByEmail(authentication.getName()).orElseThrow(() -> new RuntimeException("Utilisateur authentifié introuvable"));
    }

    private boolean isSuperAdmin(com.smboutique.api.model.Utilisateur user) {
        if (user == null) return false;
        // Determine superadmin by role membership only
        return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
    }

    @GetMapping
    public ResponseEntity<?> getAllInventaires(@RequestParam(required = false) Long boutiqueId) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        boolean superadmin = isSuperAdmin(user);

        try {
            if (superadmin) {
                // SUPERADMIN can view all or filter by boutiqueId
                if (boutiqueId != null) return ResponseEntity.ok(inventaireService.findByBoutiqueId(boutiqueId));
                return ResponseEntity.ok(inventaireService.findAll());
            }

            // Non-superadmin: ensure user has a boutique and restrict to it
            Long userBoutiqueId = user != null && user.getBoutique() != null ? user.getBoutique().getId() : null;
            if (userBoutiqueId == null) {
                // user not tied to a boutique -- deny access
                return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé: boutique non définie pour l'utilisateur"));
            }
            if (boutiqueId != null && !boutiqueId.equals(userBoutiqueId)) {
                return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé: non autorisé pour cette boutique"));
            }
            return ResponseEntity.ok(inventaireService.findByBoutiqueId(userBoutiqueId));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(java.util.Map.of("error", "Erreur serveur"));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Inventaire> getInventaireById(@PathVariable Long id) {
        return inventaireService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/next-reference")
    public ResponseEntity<?> getNextReference() {
        try {
            String ref = inventaireService.getNextReference();
            return ResponseEntity.ok(java.util.Map.of("reference", ref));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(java.util.Map.of("error", "Unable to compute next reference"));
        }
    }

    @PostMapping
    public ResponseEntity<?> createInventaire(@RequestBody Inventaire inventaire) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "INVENTAIRE_CREER")) {
            return ResponseEntity.status(403).build();
        }
        if (inventaire.getBoutique() == null || inventaire.getBoutique().getId() == null) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "id_boutique requis"));
        }

        // Enforce boutique-only inventories: Inventaire entity has no `magasin` field — any incoming magasin in payload is ignored by the mapping.
        // Actual enforcement (rejecting magasin-scoped lignes) happens at ligne-add / service level.

        // assign user
        if (user != null) inventaire.setUtilisateur(user);
        // Save first to get an id and generate reference automatically
        Inventaire saved = inventaireService.save(inventaire);
        String generatedRef = String.format("R-IV-N°%06d", saved.getId());
        saved.setReference(generatedRef);
        saved = inventaireService.save(saved);
        return ResponseEntity.status(201).body(saved);
    }

    public static class LigneInventaireRequest {
        public Long produitId;
        public Integer quantitePhysique; // units
        public Integer quantiteConditionnement; // conditionnements
        public Integer quantiteUnite; // additional units
    }

    @Autowired
    private com.smboutique.api.service.ProduitService produitService;

    @PostMapping("/{id}/lignes")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> addLigne(@PathVariable Long id, @RequestBody LigneInventaireRequest req) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "INVENTAIRE_MODIFIER")) {
            return ResponseEntity.status(403).build();
        }

        return inventaireService.findById(id)
                .map(inv -> {
                    if (inv.getRegulariser() != null && inv.getRegulariser()) {
                        return ResponseEntity.status(409).body(java.util.Map.of("code", "INVENTAIRE_REGULARISE", "message", "Inventaire déjà régularisé"));
                    }

                    if (req == null || req.produitId == null) {
                        return ResponseEntity.badRequest().body(java.util.Map.of("error", "produitId requis"));
                    }

                    com.smboutique.api.model.Produit produit = produitService.findById(req.produitId).orElse(null);
                    if (produit == null) return ResponseEntity.status(404).body(java.util.Map.of("error", "Produit introuvable"));

                    int totalUnits = 0;
                    if (req.quantitePhysique != null) {
                        totalUnits = req.quantitePhysique;
                    } else {
                        int perCondition = produit.getNombreUnitesParConditionnement() == null ? 1 : produit.getNombreUnitesParConditionnement();
                        int cond = req.quantiteConditionnement == null ? 0 : req.quantiteConditionnement;
                        int units = req.quantiteUnite == null ? 0 : req.quantiteUnite;
                        if (cond < 0 || units < 0) {
                            return ResponseEntity.badRequest().body(java.util.Map.of("error", "Quantités négatives non autorisées"));
                        }
                        totalUnits = cond * perCondition + units;
                    }
                    if (totalUnits < 0) {
                        return ResponseEntity.badRequest().body(java.util.Map.of("error", "Quantité totale invalide"));
                    }

                    // SERVER-SIDE SCOPE VALIDATION (current data model: inventaire has no magasin field)
                    // Goal: allow inventaires that are implicitly "magasin-scoped" (all lignes reference produits with stock.magasin != null),
                    // but forbid mixing boutique-level and magasin-level lignes in the same inventaire.
                    Long boutiqueId = inv.getBoutique() != null ? inv.getBoutique().getId() : null;

                    // Determine produit scope by inspecting ALL stocks for the produit (not only boutique-scoped query)
                    java.util.List<com.smboutique.api.model.Stock> allStocksForProduit = stockRepository.findByProduitId(produit.getId());
                    boolean produitHasBoutiqueStock = allStocksForProduit != null && allStocksForProduit.stream().anyMatch(s -> s.getMagasin() == null && (s.getBoutique() == null || boutiqueId == null || s.getBoutique().getId().equals(boutiqueId)));
                    boolean produitHasMagasinStock = allStocksForProduit != null && allStocksForProduit.stream().anyMatch(s -> s.getMagasin() != null && s.getMagasin().getBoutique() != null && (boutiqueId == null || s.getMagasin().getBoutique().getId().equals(boutiqueId)));

                    // Enforce new policy: INVENTAIRE IS BOUTIQUE-ONLY
                    // - If produit exists ONLY at magasin-level (no boutique-level row) => reject (can't be inventoried at boutique)
                    if (produitHasMagasinStock && !produitHasBoutiqueStock) {
                        return ResponseEntity.status(409).body(java.util.Map.of("code", "OUT_OF_SCOPE", "message", "Produit présent uniquement en magasin — inventaire boutique uniquement"));
                    }

                    // Inspect existing lignes of this inventaire to infer its current scope (if any)
                    boolean invHasBoutiqueLines = false;
                    boolean invHasMagasinLines = false;
                    java.util.List<com.smboutique.api.model.LigneInventaire> existingLignes = ligneInventaireRepository.findByInventaireId(inv.getId());
                    for (com.smboutique.api.model.LigneInventaire li : existingLignes) {
                        Long pid = li.getProduit() != null ? li.getProduit().getId() : null;
                        if (pid == null) continue;
                        java.util.List<com.smboutique.api.model.Stock> stAll = stockRepository.findByProduitId(pid);
                        if (stAll != null && stAll.stream().anyMatch(s -> s.getMagasin() == null && (s.getBoutique() == null || boutiqueId == null || s.getBoutique().getId().equals(boutiqueId)))) invHasBoutiqueLines = true;
                        if (stAll != null && stAll.stream().anyMatch(s -> s.getMagasin() != null && s.getMagasin().getBoutique() != null && (boutiqueId == null || s.getMagasin().getBoutique().getId().equals(boutiqueId)))) invHasMagasinLines = true;
                    }

                    // Mixed existing lines -> invalid state (defensive). We keep this check (historical data may contain mixed lines) but do not allow new magasin lines.
                    if (invHasBoutiqueLines && invHasMagasinLines) {
                        return ResponseEntity.status(409).body(java.util.Map.of("code", "MIXED_PORTEE", "message", "Inventaire contient déjà des lignes de portées différentes"));
                    }

                    // If this inventaire currently has no lignes, ensure we don't conflict with another active inventaire of same scope
                    if (existingLignes.isEmpty()) {
                        try {
                            inventaireService.checkActiveInventoryConflictOnAddingLine(inv, produit.getId());
                        } catch (RuntimeException ex) {
                            return ResponseEntity.status(409).body(java.util.Map.of("code", "INVENTAIRE_ACTIVE", "message", ex.getMessage()));
                        }
                    }

                    // Note: we no longer support magasin-scoped inventaires — the previous branch that allowed inventaire to become magasin-scoped has been removed.

                    // If produit has neither boutique nor magasin stock (new produit), allow adding (will inherit inventaire scope)
                    // If produit has neither boutique nor magasin stock (new produit), allow adding (will inherit inventaire scope)
                    // If inventaire has no lignes yet, any produit is allowed (inventaire scope inferred from first ligne)
                    // Otherwise (both produitHasBoutiqueStock && produitHasMagasinStock) allow — resolution happens at regularisation time or by preferring magasin when inventaire is magasin-scoped.

                    try {
                        // Prefer to lookup a single ligne by inventaire+produit to avoid duplicates in concurrent cases
                        java.util.Optional<com.smboutique.api.model.LigneInventaire> existingOpt = ligneInventaireRepository.findByInventaireIdAndProduitId(inv.getId(), req.produitId);
                        if (existingOpt.isPresent()) {
                            com.smboutique.api.model.LigneInventaire existing = existingOpt.get();
                            int prev = existing.getQuantitePhysique() == null ? 0 : existing.getQuantitePhysique();
                            existing.setQuantitePhysique(prev + totalUnits);
                            com.smboutique.api.model.LigneInventaire updated = inventaireService.saveLigne(existing);
                            return ResponseEntity.ok(updated);
                        }

                        com.smboutique.api.model.LigneInventaire ligne = new com.smboutique.api.model.LigneInventaire();
                        ligne.setInventaire(inv);
                        ligne.setProduit(produit);
                        ligne.setQuantitePhysique(totalUnits);
                        com.smboutique.api.model.LigneInventaire saved = inventaireService.saveLigne(ligne);
                        return ResponseEntity.status(201).body(saved);
                    } catch (org.springframework.dao.DataIntegrityViolationException dive) {
                        // In case of race inserting duplicate due to concurrent requests + no DB constraint, try to find and update
                        java.util.Optional<com.smboutique.api.model.LigneInventaire> existingOpt2 = ligneInventaireRepository.findByInventaireIdAndProduitId(inv.getId(), req.produitId);
                        if (existingOpt2.isPresent()) {
                            com.smboutique.api.model.LigneInventaire existing = existingOpt2.get();
                            int prev = existing.getQuantitePhysique() == null ? 0 : existing.getQuantitePhysique();
                            existing.setQuantitePhysique(prev + totalUnits);
                            com.smboutique.api.model.LigneInventaire updated = inventaireService.saveLigne(existing);
                            return ResponseEntity.ok(updated);
                        }
                        throw dive;
                    } catch (RuntimeException rex) {
                        return ResponseEntity.status(409).body(java.util.Map.of("code", "MIXED_PORTEE", "message", rex.getMessage()));
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/regularize")
    public ResponseEntity<?> regularize(@PathVariable Long id) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "INVENTAIRE_REGULARISER")) {
            return ResponseEntity.status(403).build();
        }
        try {
            InventaireService.RegularisationResult res = inventaireService.regularizeInventory(id, user);
            return ResponseEntity.ok(res);
        } catch (RuntimeException e) {
            return ResponseEntity.status(409).body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Inventaire> updateInventaire(@PathVariable Long id, @RequestBody Inventaire inventaireDetails) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "INVENTAIRE_MODIFIER")) {
            return ResponseEntity.status(403).build();
        }
        return inventaireService.findById(id)
                .map(inventaire -> {
                    inventaire.setReference(inventaireDetails.getReference());
                    inventaire.setDateInventaire(inventaireDetails.getDateInventaire());
                    return ResponseEntity.ok(inventaireService.save(inventaire));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteInventaire(@PathVariable Long id) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "INVENTAIRE_SUPPRIMER")) {
            return ResponseEntity.status(403).build();
        }
        return inventaireService.findById(id)
                .map(inventaire -> {
                    inventaireService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/lignes")
    public ResponseEntity<?> getLignes(@PathVariable Long id) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "INVENTAIRE_LECTURE")) {
            return ResponseEntity.status(403).build();
        }
        return inventaireService.findById(id)
                .map(inv -> ResponseEntity.ok(ligneInventaireService.findByInventaireId(id)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/export/csv")
    public void exportCsv(@PathVariable Long id, jakarta.servlet.http.HttpServletResponse response) throws java.io.IOException {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "INVENTAIRE_LECTURE")) {
            response.sendError(403, "Permission manquante : INVENTAIRE_LECTURE");
            return;
        }
        com.smboutique.api.model.Inventaire inv = inventaireService.findById(id).orElse(null);
        if (inv == null) { response.sendError(404, "Inventaire introuvable"); return; }
        java.util.List<com.smboutique.api.model.LigneInventaire> lignes = ligneInventaireService.findByInventaireId(id);
        response.setContentType("text/csv; charset=utf-8");
        response.setHeader("Content-Disposition", "attachment; filename=inventaire_" + id + ".csv");
        try (java.io.PrintWriter pw = response.getWriter()) {
            pw.println("Produit;Quantite physique;Ecart;Montant");
            for (com.smboutique.api.model.LigneInventaire li : lignes) {
                String prod = li.getProduit() != null ? (li.getProduit().getNomProduit() != null ? li.getProduit().getNomProduit() : "") : "-";
                String q = li.getQuantitePhysique() == null ? "0" : String.valueOf(li.getQuantitePhysique());
                String ec = li.getEcartStock() == null ? "" : String.valueOf(li.getEcartStock());
                String mont = li.getMontant() == null ? "" : String.valueOf(li.getMontant());
                pw.println(String.join(";", new String[]{escapeCsv(prod), q, ec, mont}));
            }
        }
    }

    private String escapeCsv(String s) {
        if (s == null) return "";
        if (s.contains(";") || s.contains("\n") || s.contains("\r")) {
            return '"' + s.replace("\"", "\"\"") + '"';
        }
        return s;
    }

    @GetMapping("/{id}/export/pdf")
    public void exportPdf(@PathVariable Long id, jakarta.servlet.http.HttpServletResponse response) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "INVENTAIRE_LECTURE")) {
            try { response.sendError(403, "Permission manquante : INVENTAIRE_LECTURE"); } catch (Exception ignored) {};
            return;
        }
        try {
            pdfService.writeInventairePdf(id, response);
        } catch (Exception e) {
            try { response.sendError(500, "Erreur génération PDF: " + (e.getMessage() != null ? e.getMessage() : "unknown")); } catch (Exception ignored) {}
        }
    }

    @DeleteMapping("/{inventaireId}/lignes/{ligneId}")
    public ResponseEntity<?> deleteLigne(@PathVariable Long inventaireId, @PathVariable Long ligneId) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "INVENTAIRE_SUPPRIMER")) {
            return ResponseEntity.status(403).build();
        }
        return inventaireService.findById(inventaireId).map(inv -> {
            if (inv.getRegulariser() != null && inv.getRegulariser()) {
                return ResponseEntity.status(409).body(java.util.Map.of("code", "INVENTAIRE_REGULARISE", "message", "Inventaire déjà régularisé"));
            }
            return ligneInventaireService.findById(ligneId).map(li -> {
                if (li.getInventaire() == null || li.getInventaire().getId() == null || !li.getInventaire().getId().equals(inventaireId)) {
                    return ResponseEntity.status(400).body(java.util.Map.of("error", "La ligne n'appartient pas à cet inventaire"));
                }
                ligneInventaireService.deleteById(ligneId);
                return ResponseEntity.ok().build();
            }).orElse(ResponseEntity.notFound().build());
        }).orElse(ResponseEntity.notFound().build());
    }
}
