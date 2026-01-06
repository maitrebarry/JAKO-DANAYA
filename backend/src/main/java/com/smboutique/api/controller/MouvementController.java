package com.smboutique.api.controller;

import com.smboutique.api.model.Mouvement;
import com.smboutique.api.service.MouvementService;
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
    public ResponseEntity<?> getAllMouvements() {
        com.smboutique.api.model.Utilisateur currentUser;
        try {
            currentUser = getCurrentUser();
        } catch (RuntimeException ex) {
            return ResponseEntity.status(401).build();
        }
        boolean isAuditor = isSuperAdmin(currentUser) || utilisateurService.hasPermission(currentUser, "MOUVEMENT_AUDIT");
        if (isAuditor) {
            return ResponseEntity.ok(mouvementService.findAll());
        } else {
            Long boutiqueId = currentUser.getBoutique() != null ? currentUser.getBoutique().getId() : null;
            java.util.List<Mouvement> res = mouvementService.search(null, null, null, boutiqueId, null, null, null, null);
            return ResponseEntity.ok(res);
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
            java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
            java.util.List<java.util.Map<String,Object>> items = new java.util.ArrayList<>();
            for (Mouvement m : res.getItems()) {
                java.util.Map<String,Object> map = new java.util.HashMap<>();
                map.put("id", m.getId());
                map.put("dateMouvement", m.getDateMouvement() != null ? m.getDateMouvement().format(fmt) : null);
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
            map.put("dateMouvement", m.getDateMouvement() != null ? m.getDateMouvement().format(fmt) : null);
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
                String date = m.getDateMouvement() != null ? m.getDateMouvement().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")) : "";
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
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "INVENTAIRE_MODIFIER")) {
            return ResponseEntity.status(403).build();
        }
        return mouvementService.findById(id)
                .map(mouvement -> {
                    mouvement.setLigneReception(mouvementDetails.getLigneReception());
                    mouvement.setLigneLivraison(mouvementDetails.getLigneLivraison());
                    mouvement.setLigneVente(mouvementDetails.getLigneVente());
                    mouvement.setProduit(mouvementDetails.getProduit());
                    mouvement.setQuantite(mouvementDetails.getQuantite());
                    mouvement.setTypeMouvement(mouvementDetails.getTypeMouvement());
                    mouvement.setMontant(mouvementDetails.getMontant());
                    mouvement.setDateMouvement(mouvementDetails.getDateMouvement());
                    return ResponseEntity.ok(mouvementService.save(mouvement));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMouvement(@PathVariable Long id) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "INVENTAIRE_SUPPRIMER")) {
            return ResponseEntity.status(403).build();
        }
        return mouvementService.findById(id)
                .map(mouvement -> {
                    mouvementService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
