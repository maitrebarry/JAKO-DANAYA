package com.smboutique.api.controller;

import com.smboutique.api.model.Mouvement;
import com.smboutique.api.service.MouvementService;
import com.smboutique.api.service.UtilisationPertesService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/mouvements")
@CrossOrigin(origins = "*")
public class MouvementController {

    @Autowired
    private MouvementService mouvementService;

    @Autowired
    private com.smboutique.api.service.UtilisateurService utilisateurService;

    @Autowired
    private UtilisationPertesService utilisationPertesService;

    @Autowired
    private com.smboutique.api.repository.BoutiqueRepository boutiqueRepository;

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

    // Helper to format LocalDateTime to Africa/Dakar zone string
    private String formatToDakar(java.time.LocalDateTime dt) {
        if (dt == null) return null;
        return com.smboutique.api.util.DateUtils.formatToDakar(dt);
    }

    @GetMapping
    public ResponseEntity<?> getAllMouvements() {
        com.smboutique.api.model.Utilisateur currentUser;
        try {
            currentUser = getCurrentUser();
        } catch (RuntimeException ex) {
            return ResponseEntity.status(401).build();
        }
        boolean isAuditor = isSuperAdmin(currentUser) || utilisateurService.hasPermission(currentUser, "MOUVEMENT_AUDIT");
        if (isAuditor) {
            java.util.List<Mouvement> mouvements = mouvementService.findAll();
            return ResponseEntity.ok(enrichMouvementsWithCurrency(mouvements));
        } else {
            Long boutiqueId = currentUser.getBoutique() != null ? currentUser.getBoutique().getId() : null;
            java.util.List<Mouvement> res = mouvementService.search(null, null, null, boutiqueId, null, null, null, null);
            return ResponseEntity.ok(enrichMouvementsWithCurrency(res));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Mouvement> getMouvementById(@PathVariable Long id) {
        return mouvementService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchMovements(
            @RequestParam(value = "userId", required = false) Long userId,
            @RequestParam(value = "type", required = false) String type,
            @RequestParam(value = "sousType", required = false) String sousType,
            @RequestParam(value = "boutiqueId", required = false) Long boutiqueId,
            @RequestParam(value = "magasinId", required = false) Long magasinId,
            @RequestParam(value = "referenceId", required = false) Long referenceId,
            @RequestParam(value = "from", required = false) String fromStr,
            @RequestParam(value = "to", required = false) String toStr,
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "size", required = false) Integer size
    ) {
        com.smboutique.api.model.Utilisateur currentUser;
        try {
            currentUser = getCurrentUser();
        } catch (RuntimeException ex) {
            return ResponseEntity.status(401).body(java.util.Map.of("error", "Authentication required"));
        }

        // parse dates
        java.time.LocalDateTime from = null, to = null;
        try {
            if (fromStr != null && !fromStr.isEmpty()) from = java.time.LocalDateTime.parse(fromStr);
            if (toStr != null && !toStr.isEmpty()) to = java.time.LocalDateTime.parse(toStr);
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "Invalid date format. Use ISO date-time."));
        }

        boolean isAuditor = isSuperAdmin(currentUser) || utilisateurService.hasPermission(currentUser, "MOUVEMENT_AUDIT");

        if (userId != null && !userId.equals(currentUser.getId()) && !isAuditor) {
            // non-auditors cannot query other users
            return ResponseEntity.status(403).body(java.util.Map.of("error", "Permission requise: MOUVEMENT_AUDIT"));
        }

        if (!isAuditor) {
            // enforce restriction to self
            userId = currentUser.getId();
            // enforce restriction to current boutique (non-auditors cannot query other boutiques)
            if (currentUser.getBoutique() != null) {
                boutiqueId = currentUser.getBoutique().getId();
            }
        } else {
            // For auditors: if they did not explicitly filter by boutique or user, default to their own boutique to avoid exposing all data unintentionally
            if (userId == null && boutiqueId == null && currentUser.getBoutique() != null && !isSuperAdmin(currentUser)) {
                boutiqueId = currentUser.getBoutique().getId();
            }
        }

        // If pagination requested, return paginated result
        if (page != null) {
            int p = page == null ? 1 : page;
            int s = (size == null || size <= 0) ? 25 : size;
            com.smboutique.api.service.MouvementSearchResult res = mouvementService.searchPage(userId, type, sousType, boutiqueId, magasinId, referenceId, from, to, p, s);
            java.util.List<java.util.Map<String,Object>> items = new java.util.ArrayList<>();
            for (Mouvement m : res.getItems()) {
                java.util.Map<String,Object> map = new java.util.HashMap<>();
                map.put("id", m.getId());
                map.put("dateMouvement", m.getDateMouvement() != null ? formatToDakar(m.getDateMouvement()) : null);
                map.put("typeMouvement", m.getTypeMouvement());
                map.put("sousType", m.getSousType());
                map.put("utilisateur", m.getUtilisateur());
                map.put("boutique", m.getBoutique());
                map.put("magasin", m.getMagasin());
                map.put("produit", m.getProduit());
                map.put("quantite", m.getQuantite());
                map.put("montant", m.getMontant());
                String descVal = m.getDescription() != null ? m.getDescription().replaceAll("(?i)\\bids?\\s*[:=]?\\s*\\d+\\b", "").replaceAll("#\\d+\\b", "").replaceAll("\\b\\d{4,}\\b", "").trim() : null;
                map.put("description", descVal);
                map.put("referenceId", m.getReferenceId());

                // Add currency symbol
                String deviseSymbole = "FCFA";
                try {
                    if (m.getBoutique() != null && m.getBoutique().getPays() != null && m.getBoutique().getPays().getDeviseSymbole() != null) {
                        deviseSymbole = m.getBoutique().getPays().getDeviseSymbole();
                    }
                } catch (Exception e) {
                    // keep default
                }
                map.put("deviseSymbole", deviseSymbole);

                items.add(map);
            }
            return ResponseEntity.ok(java.util.Map.of("total", res.getTotal(), "items", items));
        }

        List<Mouvement> result = mouvementService.search(userId, type, sousType, boutiqueId, magasinId, referenceId, from, to);
        // Map to JSON-friendly structure with formatted date to ensure consistent display and avoid deserialization issues
        java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
        java.util.List<java.util.Map<String,Object>> out = new java.util.ArrayList<>();
        for (Mouvement m : result) {
            java.util.Map<String,Object> map = new java.util.HashMap<>();
            map.put("id", m.getId());
            map.put("dateMouvement", m.getDateMouvement() != null ? formatToDakar(m.getDateMouvement()) : null);
            map.put("typeMouvement", m.getTypeMouvement());
            map.put("sousType", m.getSousType());
            map.put("utilisateur", m.getUtilisateur());
            map.put("boutique", m.getBoutique());
            map.put("magasin", m.getMagasin());
            map.put("produit", m.getProduit());
            map.put("quantite", m.getQuantite());
            map.put("montant", m.getMontant());
            String descVal = m.getDescription() != null ? m.getDescription().replaceAll("(?i)\\bids?\\s*[:=]?\\s*\\d+\\b", "").replaceAll("#\\d+\\b", "").replaceAll("\\b\\d{4,}\\b", "").trim() : null;
            map.put("description", descVal);
            map.put("referenceId", m.getReferenceId());

            // Add currency symbol
            String deviseSymbole = "FCFA";
            try {
                if (m.getBoutique() != null && m.getBoutique().getPays() != null && m.getBoutique().getPays().getDeviseSymbole() != null) {
                    deviseSymbole = m.getBoutique().getPays().getDeviseSymbole();
                }
            } catch (Exception e) {
                // keep default
            }
            map.put("deviseSymbole", deviseSymbole);

            out.add(map);
        }
        return ResponseEntity.ok(out);
    }

    @GetMapping("/export")
    public void exportMovements(
            @RequestParam(value = "userId", required = false) Long userId,
            @RequestParam(value = "type", required = false) String type,
            @RequestParam(value = "sousType", required = false) String sousType,
            @RequestParam(value = "boutiqueId", required = false) Long boutiqueId,
            @RequestParam(value = "magasinId", required = false) Long magasinId,
            @RequestParam(value = "referenceId", required = false) Long referenceId,
            @RequestParam(value = "from", required = false) String fromStr,
            @RequestParam(value = "to", required = false) String toStr,
            jakarta.servlet.http.HttpServletResponse response
    ) {
        com.smboutique.api.model.Utilisateur currentUser = getCurrentUser();

        // parse dates
        java.time.LocalDateTime from = null, to = null;
        try {
            if (fromStr != null && !fromStr.isEmpty()) from = java.time.LocalDateTime.parse(fromStr);
            if (toStr != null && !toStr.isEmpty()) to = java.time.LocalDateTime.parse(toStr);
        } catch (Exception ex) {
            response.setStatus(400);
            try { response.getWriter().write("Invalid date format. Use ISO date-time."); } catch (Exception ignored) {}
            return;
        }

        boolean isAuditor = isSuperAdmin(currentUser) || utilisateurService.hasPermission(currentUser, "MOUVEMENT_AUDIT");

        if (userId != null && !userId.equals(currentUser.getId()) && !isAuditor) {
            response.setStatus(403);
            try { response.getWriter().write("Permission requise: MOUVEMENT_AUDIT"); } catch (Exception ignored) {}
            return;
        }

        if (!isAuditor) {
            userId = currentUser.getId();
            if (currentUser.getBoutique() != null) {
                boutiqueId = currentUser.getBoutique().getId();
            }
        }

        // Export: ensure auditors default to their boutique when no explicit boutique/user filter is provided
        if (isAuditor && userId == null && boutiqueId == null && currentUser.getBoutique() != null && !isSuperAdmin(currentUser)) {
            boutiqueId = currentUser.getBoutique().getId();
        }

        List<Mouvement> result = mouvementService.search(userId, type, sousType, boutiqueId, magasinId, referenceId, from, to);

        // stream CSV
        response.setContentType("text/csv; charset=utf-8");
        String filename = "mouvements_" + java.time.LocalDateTime.now().toString().replace(':','-') + ".csv";
        response.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");

        try (java.io.PrintWriter pw = response.getWriter()) {
            // header (French labels) - removed Réf column
            pw.println("Date,Type,Sous-type,Utilisateur,Boutique,Magasin,Produit,Quantité,Montant,Description");
            for (Mouvement m : result) {
                String date = m.getDateMouvement() != null ? formatToDakar(m.getDateMouvement()) : "";
                String typeOut = m.getTypeMouvement() != null ? m.getTypeMouvement() : "";
                String sous = m.getSousType() != null ? m.getSousType() : "";
                String userOut = "";
                if (m.getUtilisateur() != null) {
                    userOut = m.getUtilisateur().getPrenom() != null ? m.getUtilisateur().getPrenom() + " " + (m.getUtilisateur().getNom() != null ? m.getUtilisateur().getNom() : "") : m.getUtilisateur().getEmail();
                }
                String b = m.getBoutique() != null ? m.getBoutique().getNom() : "";
                String mag = m.getMagasin() != null ? m.getMagasin().getNom() : "";
                String prod = m.getProduit() != null && m.getProduit().getNomProduit() != null ? m.getProduit().getNomProduit() : "";
                String q = m.getQuantite() != null ? String.valueOf(m.getQuantite()) : "";
                String mont = m.getMontant() != null ? String.valueOf(m.getMontant()) : "";
                String desc = m.getDescription() != null ? m.getDescription().replaceAll("\"", "\"\"") : "";
                // remove IDs from description (common patterns)
                desc = desc.replaceAll("(?i)\\bids?\\s*[:=]?\\s*\\d+\\b", "");
                desc = desc.replaceAll("#\\d+\\b", "");
                desc = desc.replaceAll("\\b\\d{4,}\\b", "");
                desc = desc.trim();
                // quote fields
                pw.println(String.format("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"",
                        date, typeOut, sous, userOut, b, mag, prod, q, mont, desc));
            }
            pw.flush();
        } catch (Exception e) {
            // ignore
        }
    }

    @PostMapping("/utilisations")
    public ResponseEntity<?> createUtilisation(@RequestBody com.smboutique.api.dto.UtilisationRequest req) {
        com.smboutique.api.model.Utilisateur currentUser;
        try { currentUser = getCurrentUser(); } catch (RuntimeException ex) { return ResponseEntity.status(401).body(java.util.Map.of("error","Authentication required")); }
        // permission check
        if (!isSuperAdmin(currentUser) && !utilisateurService.hasPermission(currentUser, "UTILISA_PERTE_CREER")) {
            return ResponseEntity.status(403).body(java.util.Map.of("error","Permission requise: UTILISA_PERTE_CREER"));
        }
        try {
            com.smboutique.api.model.Mouvement mv = mouvementService.createUtilisation(req, currentUser);
            return ResponseEntity.ok(mv);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(java.util.Map.of("error", "Server error"));
        }
    }

    @GetMapping("/utilisations")
    public ResponseEntity<?> listUtilisations(
            @RequestParam(value = "produitId", required = false) Long produitId,
            @RequestParam(value = "magasinId", required = false) Long magasinId,
            @RequestParam(value = "from", required = false) String fromStr,
            @RequestParam(value = "to", required = false) String toStr,
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "size", required = false) Integer size
    ) {
        com.smboutique.api.model.Utilisateur currentUser;
        try { currentUser = getCurrentUser(); } catch (RuntimeException ex) { return ResponseEntity.status(401).body(java.util.Map.of("error","Authentication required")); }
        boolean isAuditor = isSuperAdmin(currentUser) || utilisateurService.hasPermission(currentUser, "MOUVEMENT_AUDIT") || utilisateurService.hasPermission(currentUser, "UTILISA_PERTE_VOIR");

        if (!isAuditor) {
            // non auditors see only their boutique
            if (currentUser.getBoutique() != null) {
                // override magasinId if needed (we keep behavior simple and restrict to boutique)
            }
        }

        java.time.LocalDateTime from = null, to = null;
        try {
            if (fromStr != null && !fromStr.isEmpty()) from = java.time.LocalDateTime.parse(fromStr);
            if (toStr != null && !toStr.isEmpty()) to = java.time.LocalDateTime.parse(toStr);
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "Invalid date format. Use ISO date-time."));
        }

        // delegate to mouvementService.search with type filter
        String type = "UTILISATION";
        if (page != null) {
            int p = page == null ? 1 : page;
            int s = (size == null || size <= 0) ? 25 : size;
            com.smboutique.api.service.MouvementSearchResult res = mouvementService.searchPage(null, type, null, currentUser.getBoutique() != null ? currentUser.getBoutique().getId() : null, magasinId, null, from, to, p, s);
            java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
            java.util.List<java.util.Map<String,Object>> items = new java.util.ArrayList<>();
            for (com.smboutique.api.model.Mouvement m : res.getItems()) {
                java.util.Map<String,Object> map = new java.util.HashMap<>();
                map.put("id", m.getId());
                map.put("dateMouvement", m.getDateMouvement() != null ? formatToDakar(m.getDateMouvement()) : null);
                map.put("sousType", m.getSousType());
                // ensure we expose quantity: prefer Mouvement.quantite but fallback to utilisation_pertes record when empty
                Integer q = m.getQuantite();
                if ((q == null || q == 0) && m.getId() != null) {
                    try {
                        java.util.Optional<com.smboutique.api.model.UtilisationPertes> upOpt = utilisationPertesService.findByMouvementId(m.getId());
                        if (upOpt.isPresent()) q = upOpt.get().getQuantite();
                    } catch (Exception ex) { /* ignore */ }
                }
                map.put("quantite", q);
                map.put("produit", m.getProduit());
                map.put("magasin", m.getMagasin());
                map.put("boutique", m.getBoutique());
                map.put("utilisateur", m.getUtilisateur());
                map.put("description", m.getDescription());
                items.add(map);
            }
            return ResponseEntity.ok(java.util.Map.of("total", res.getTotal(), "items", items));
        }

        java.util.List<com.smboutique.api.model.Mouvement> result = mouvementService.search(null, type, null, currentUser.getBoutique() != null ? currentUser.getBoutique().getId() : null, magasinId, null, from, to);
        java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
        java.util.List<java.util.Map<String,Object>> out = new java.util.ArrayList<>();
        for (com.smboutique.api.model.Mouvement m : result) {
            java.util.Map<String,Object> map = new java.util.HashMap<>();
            map.put("id", m.getId());
            map.put("dateMouvement", m.getDateMouvement() != null ? formatToDakar(m.getDateMouvement()) : null);
            map.put("sousType", m.getSousType());
            // ensure we expose quantity: prefer Mouvement.quantite but fallback to utilisation_pertes record when empty
            Integer q = m.getQuantite();
            if ((q == null || q == 0) && m.getId() != null) {
                try {
                    java.util.Optional<com.smboutique.api.model.UtilisationPertes> upOpt = utilisationPertesService.findByMouvementId(m.getId());
                    if (upOpt.isPresent()) q = upOpt.get().getQuantite();
                } catch (Exception ex) { /* ignore */ }
            }
            map.put("quantite", q);
            map.put("produit", m.getProduit());
            map.put("magasin", m.getMagasin());
            map.put("boutique", m.getBoutique());
            map.put("utilisateur", m.getUtilisateur());
            map.put("description", m.getDescription());
            out.add(map);
        }
        return ResponseEntity.ok(out);
    }

    @GetMapping("/utilisations/export")
    public void exportUtilisations(
            @RequestParam(value = "produitId", required = false) Long produitId,
            @RequestParam(value = "magasinId", required = false) Long magasinId,
            @RequestParam(value = "from", required = false) String fromStr,
            @RequestParam(value = "to", required = false) String toStr,
            jakarta.servlet.http.HttpServletResponse response
    ) {
        com.smboutique.api.model.Utilisateur currentUser = getCurrentUser();
        boolean isAuditor = isSuperAdmin(currentUser) || utilisateurService.hasPermission(currentUser, "MOUVEMENT_AUDIT") || utilisateurService.hasPermission(currentUser, "UTILISA_PERTE_VOIR");
        if (!isAuditor) {
            // non-auditors allowed but limited to their boutique (no special action necessary here)
        }
        java.time.LocalDateTime from = null, to = null;
        try {
            if (fromStr != null && !fromStr.isEmpty()) from = java.time.LocalDateTime.parse(fromStr);
            if (toStr != null && !toStr.isEmpty()) to = java.time.LocalDateTime.parse(toStr);
        } catch (Exception ex) {
            response.setStatus(400);
            try { response.getWriter().write("Invalid date format. Use ISO date-time."); } catch (Exception ignored) {}
            return;
        }

        List<Mouvement> result = mouvementService.search(null, "UTILISATION", null, currentUser.getBoutique() != null ? currentUser.getBoutique().getId() : null, magasinId, null, from, to);

        response.setContentType("text/csv; charset=utf-8");
        String filename = "utilisations_" + java.time.LocalDateTime.now().toString().replace(':','-') + ".csv";
        response.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");

        try (java.io.PrintWriter pw = response.getWriter()) {
            pw.println("Date,Produit,Magasin,Boutique,Utilisateur,Quantité,Sous-type,Description");
            java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
            for (Mouvement m : result) {
                String date = m.getDateMouvement() != null ? formatToDakar(m.getDateMouvement()) : "";
                String prod = m.getProduit() != null ? (m.getProduit().getNomProduit() != null ? m.getProduit().getNomProduit() : "") : "";
                String mag = m.getMagasin() != null ? (m.getMagasin().getNom() != null ? m.getMagasin().getNom() : "") : "";
                String b = m.getBoutique() != null ? (m.getBoutique().getNom() != null ? m.getBoutique().getNom() : "") : "";
                String userOut = m.getUtilisateur() != null ? (m.getUtilisateur().getPrenom() != null ? m.getUtilisateur().getPrenom() + " " + (m.getUtilisateur().getNom() != null ? m.getUtilisateur().getNom() : "") : m.getUtilisateur().getEmail()) : "";
                String q = m.getQuantite() != null ? String.valueOf(m.getQuantite()) : "";
                String sous = m.getSousType() != null ? m.getSousType() : "";
                String desc = m.getDescription() != null ? m.getDescription().replaceAll("\"", "\"\"") : "";
                pw.println(String.format("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"", date, prod, mag, b, userOut, q, sous, desc));
            }
            pw.flush();
        } catch (Exception e) {
            // ignore
        }
    }

    @GetMapping("/reports/caisse/summary")
    public ResponseEntity<?> caisseSummary(
            @RequestParam(value = "period", required = false, defaultValue = "day") String period,
            @RequestParam(value = "userId", required = false) Long userId,
            @RequestParam(value = "boutiqueId", required = false) Long boutiqueId,
            @RequestParam(value = "magasinId", required = false) Long magasinId,
            @RequestParam(value = "from", required = false) String fromStr,
            @RequestParam(value = "to", required = false) String toStr
    ) {
        com.smboutique.api.model.Utilisateur currentUser;
        try {
            currentUser = getCurrentUser();
        } catch (RuntimeException ex) {
            return ResponseEntity.status(401).body(java.util.Map.of("error", "Authentication required"));
        }

        boolean isAuditor = isSuperAdmin(currentUser) || utilisateurService.hasPermission(currentUser, "MOUVEMENT_AUDIT");
        boolean isOwner = "PROPRIETAIRE".equalsIgnoreCase(currentUser.getTypeUtilisateur());

        // if userId filter is provided, enforce permission checks
        if (userId != null && !userId.equals(currentUser.getId())) {
            // Check if the target user exists and is in the same boutique
            com.smboutique.api.model.Utilisateur worker = utilisateurService.findById(userId).orElse(null);
            if (worker == null) return ResponseEntity.status(404).body(java.util.Map.of("error", "Utilisateur introuvable"));
            if (worker.getBoutique() == null || currentUser.getBoutique() == null || !worker.getBoutique().getId().equals(currentUser.getBoutique().getId())) {
                return ResponseEntity.status(403).body(java.util.Map.of("error", "Utilisateur hors de votre boutique"));
            }
            // For caisse summary, allow all users in the same boutique to view summaries of other users
            // No additional permission check needed for basic caisse summary access
        }

        // parse dates
        java.time.LocalDateTime from = null, to = null;
        try {
            if (fromStr != null && !fromStr.isEmpty()) {
                java.time.LocalDate fromDate = java.time.LocalDate.parse(fromStr);
                from = fromDate.atStartOfDay();
            }
            if (toStr != null && !toStr.isEmpty()) {
                java.time.LocalDate toDate = java.time.LocalDate.parse(toStr);
                to = toDate.atStartOfDay();
            }
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "Invalid date format. Use ISO date (YYYY-MM-DD)."));
        }

        // If no boutiqueId provided and user is owner, set to their boutique
        if (boutiqueId == null && "PROPRIETAIRE".equalsIgnoreCase(currentUser.getTypeUtilisateur()) && currentUser.getBoutique() != null) {
            boutiqueId = currentUser.getBoutique().getId();
        }

        try {
            com.smboutique.api.service.dto.CaisseSummaryResult res = mouvementService.summarizeCaisse(period, userId, boutiqueId, magasinId, from, to);
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            // log stacktrace for debugging and return readable error to client
            org.slf4j.LoggerFactory.getLogger(MouvementController.class).error("caisseSummary error: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(java.util.Map.of("error", "Internal Server Error", "message", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<Mouvement> createMouvement(@RequestBody Mouvement mouvement) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "INVENTAIRE_CREER")) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(mouvementService.save(mouvement));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Mouvement> updateMouvement(@PathVariable Long id, @RequestBody Mouvement mouvementDetails) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        java.util.Optional<Mouvement> existingOpt = mouvementService.findById(id);
        if (existingOpt.isEmpty()) return ResponseEntity.notFound().build();
        Mouvement existing = existingOpt.get();
        // choose permission depending on type
        if ("UTILISATION".equalsIgnoreCase(existing.getTypeMouvement())) {
            if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "UTILISA_PERTE_MODIFIER")) {
                return ResponseEntity.status(403).build();
            }
        } else {
            if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "INVENTAIRE_MODIFIER")) {
                return ResponseEntity.status(403).build();
            }
        }

        // If this is an utilisation, delegate to service which will handle stock adjustments atomically
        if ("UTILISATION".equalsIgnoreCase(existing.getTypeMouvement())) {
            try {
                com.smboutique.api.model.Mouvement updated = mouvementService.updateUtilisation(id, mouvementDetails, user);
                return ResponseEntity.ok(updated);
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.badRequest().build();
            }
        }

        return existingOpt
                .map(mouvement -> {
                    mouvement.setLigneReception(mouvementDetails.getLigneReception());
                    mouvement.setLigneLivraison(mouvementDetails.getLigneLivraison());
                    mouvement.setLigneVente(mouvementDetails.getLigneVente());
                    mouvement.setProduit(mouvementDetails.getProduit());
                    mouvement.setQuantite(mouvementDetails.getQuantite());
                    mouvement.setTypeMouvement(mouvementDetails.getTypeMouvement());
                    mouvement.setMontant(mouvementDetails.getMontant());
                    mouvement.setDateMouvement(mouvementDetails.getDateMouvement());
                    Mouvement saved = mouvementService.save(mouvement);
                    // if this is a utilisation, update the corresponding utilisation_pertes record
                    try {
                        if ("UTILISATION".equalsIgnoreCase(saved.getTypeMouvement())) {
                            java.util.Optional<com.smboutique.api.model.UtilisationPertes> upOpt = utilisationPertesService.findByMouvementId(saved.getId());
                            if (upOpt.isPresent()) {
                                com.smboutique.api.model.UtilisationPertes up = upOpt.get();
                                up.setMotif(saved.getDescription());
                                up.setQuantite(saved.getQuantite());
                                up.setDate(saved.getDateMouvement() != null ? saved.getDateMouvement().toLocalDate() : java.time.LocalDate.now());
                                up.setType(saved.getSousType());
                                up.setProduit(saved.getProduit());
                                utilisationPertesService.save(up);
                            }
                        }
                    } catch (Exception ex) {
                        // log and continue
                        org.slf4j.LoggerFactory.getLogger(MouvementController.class).warn("Failed to synchronize utilisation_pertes on update: {}", ex.getMessage());
                    }
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMouvement(@PathVariable Long id) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        java.util.Optional<Mouvement> existingOpt = mouvementService.findById(id);
        if (existingOpt.isEmpty()) return ResponseEntity.notFound().build();
        Mouvement existing = existingOpt.get();
        // choose permission depending on type
        if ("UTILISATION".equalsIgnoreCase(existing.getTypeMouvement())) {
            if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "UTILISA_PERTE_SUPPRIMER")) {
                return ResponseEntity.status(403).build();
            }
        } else {
            if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "INVENTAIRE_SUPPRIMER")) {
                return ResponseEntity.status(403).build();
            }
        }
        try {
            mouvementService.deleteById(id);
            // delete corresponding utilisation_pertes record if any
            try { utilisationPertesService.deleteByMouvementId(id); } catch (Exception ex) { /* ignore */ }
            return ResponseEntity.ok().<Void>build();
        } catch (Exception ex) {
            return ResponseEntity.status(500).build();
        }
    }

    private java.util.List<java.util.Map<String, Object>> enrichMouvementsWithCurrency(java.util.List<Mouvement> mouvements) {
        java.util.List<java.util.Map<String, Object>> enriched = new java.util.ArrayList<>();
        for (Mouvement m : mouvements) {
            java.util.Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", m.getId());
            map.put("ligneReception", m.getLigneReception());
            map.put("ligneLivraison", m.getLigneLivraison());
            map.put("ligneVente", m.getLigneVente());
            map.put("produit", m.getProduit());
            map.put("stock", m.getStock());
            map.put("boutique", m.getBoutique());
            map.put("transfer", m.getTransfer());
            map.put("utilisateur", m.getUtilisateur());
            map.put("sousType", m.getSousType());
            map.put("description", m.getDescription());
            map.put("referenceId", m.getReferenceId());
            map.put("inventaire", m.getInventaire());
            map.put("referenceInventaire", m.getReferenceInventaire());
            map.put("magasin", m.getMagasin());
            map.put("quantite", m.getQuantite());
            map.put("typeMouvement", m.getTypeMouvement());
            map.put("montant", m.getMontant());
            map.put("dateMouvement", m.getDateMouvement());

            // Add currency symbol
            String deviseSymbole = "FCFA";
            try {
                if (m.getBoutique() != null && m.getBoutique().getPays() != null && m.getBoutique().getPays().getDeviseSymbole() != null) {
                    deviseSymbole = m.getBoutique().getPays().getDeviseSymbole();
                }
            } catch (Exception e) {
                // keep default
            }
            map.put("deviseSymbole", deviseSymbole);

            enriched.add(map);
        }
        return enriched;
    }
}
