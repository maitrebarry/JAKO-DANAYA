package com.smboutique.api.controller;

import com.smboutique.api.model.Livraison;
import com.smboutique.api.service.LivraisonService;
import com.smboutique.api.service.LigneLivraisonService;
import com.smboutique.api.service.LigneCommandeClientService;
import com.smboutique.api.service.StockService;import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/livraisons")
@CrossOrigin(origins = "*")
public class LivraisonController {

    @Autowired
    private LivraisonService livraisonService;

    @Autowired
    private LigneLivraisonService ligneLivraisonService;

    @Autowired
    private LigneCommandeClientService ligneCommandeClientService;

    @Autowired
    private StockService stockService;

    @Autowired
    private com.smboutique.api.service.UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.service.PdfService pdfService;

    private com.smboutique.api.model.Utilisateur getCurrentUser() {
        org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("Utilisateur authentifié introuvable");
        }
        return utilisateurService.findByEmail(authentication.getName()).orElseThrow(() -> new RuntimeException("Utilisateur authentifié introuvable"));
    }

    private boolean isSuperAdmin(com.smboutique.api.model.Utilisateur user) {
        if (user == null) return false;
        return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
    }
    @GetMapping
    public List<Livraison> getAllLivraisons() {
        return livraisonService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Livraison> getLivraisonById(@PathVariable Long id) {
        return livraisonService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/pdf")
    public void getLivraisonPdf(@PathVariable Long id, jakarta.servlet.http.HttpServletResponse response) {
        try {
            pdfService.writeLivraisonPdf(id, response);
        } catch (Exception e) {
            try { response.sendError(500); } catch (Exception ignored) {}
        }
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<Object> cancelLivraison(@PathVariable Long id, @RequestBody(required = false) java.util.Map<String, String> body) {
        org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(403).build();
        }
        com.smboutique.api.model.Utilisateur user = utilisateurService.findByEmail(authentication.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(403).build();
        boolean hasPerm = user.getPermissions().stream().anyMatch(p -> p.getName().equals("RECEPTION_SUPPRESSION") || p.getName().equals("RECEPTION_ANNULATION"));
        if (!hasPerm) return ResponseEntity.status(403).build();

        java.util.Optional<Livraison> opt = livraisonService.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        Livraison livraison = opt.get();
        if (livraison.getAnnule() != null && livraison.getAnnule()) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "Livraison déjà annulée"));
        }
        try {
            // revert stocks and ligne commande quantiteLivre
            java.util.List<com.smboutique.api.model.LigneLivraison> lignes = ligneLivraisonService.findByLivraisonId(livraison.getId());
            for (com.smboutique.api.model.LigneLivraison ll : lignes) {
                // revert stock (add back)
                if (ll.getProduit() != null && ll.getProduit().getId() != null && ll.getQuantiteRecu() != null && ll.getQuantiteRecu() > 0) {
                    // try to find stock by produit and boutique - use stockRepository findAll as fallback
                    java.util.Optional<com.smboutique.api.model.Stock> sOpt = stockService.getAllStocks().stream().filter(s -> s.getProduit() != null && s.getProduit().getId() != null && s.getProduit().getId().equals(ll.getProduit().getId())).findFirst();
                    if (sOpt.isPresent()) {
                        com.smboutique.api.model.Stock s = sOpt.get();
                        Integer cur = s.getQuantiteDisponible() != null ? s.getQuantiteDisponible() : 0;
                        s.setQuantiteDisponible(cur + ll.getQuantiteRecu());
                        stockService.saveStock(s);
                    }
                }
                // reduce quantiteLivre on related commande ligne
                try {
                    if (livraison.getCommandeClient() != null && ll.getProduit() != null) {
                        // find ligneCommande by produit and commande
                        java.util.List<com.smboutique.api.model.LigneCommandeClient> lcs = ligneCommandeClientService.findAll();
                        for (com.smboutique.api.model.LigneCommandeClient lcc : lcs) {
                            if (lcc.getCommandeClient() != null && lcc.getCommandeClient().getId() != null && lcc.getCommandeClient().getId().equals(livraison.getCommandeClient().getId()) && lcc.getProduit() != null && lcc.getProduit().getId() != null && lcc.getProduit().getId().equals(ll.getProduit().getId())) {
                                Integer cur = lcc.getQuantiteLivre() != null ? lcc.getQuantiteLivre() : 0;
                                lcc.setQuantiteLivre(Math.max(0, cur - (ll.getQuantiteRecu() != null ? ll.getQuantiteRecu() : 0)));
                                ligneCommandeClientService.save(lcc);
                            }
                        }
                    }
                } catch (Exception ex) {
                    // ignore per-line revert errors
                }
            }

            livraison.setAnnule(true);
            livraison.setAnnuleAt(java.time.LocalDateTime.now());
            livraison.setAnnulePar(user.getId());
            livraison.setAnnuleReason(body != null ? body.getOrDefault("reason", null) : null);
            livraisonService.save(livraison);
            return ResponseEntity.ok(java.util.Map.of("id", livraison.getId(), "annule", true));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(java.util.Map.of("error", "Internal server error"));
        }
    }

    @PostMapping
    public Livraison createLivraison(@RequestBody Livraison livraison) {
        return livraisonService.save(livraison);
    }
    @PutMapping("/{id}")
    public ResponseEntity<Livraison> updateLivraison(@PathVariable Long id, @RequestBody Livraison livraisonDetails) {
        return livraisonService.findById(id)
                .map(livraison -> {
                    livraison.setReference(livraisonDetails.getReference());
                    livraison.setDateLivraison(livraisonDetails.getDateLivraison());
                    livraison.setCommandeClient(livraisonDetails.getCommandeClient());
                    return ResponseEntity.ok(livraisonService.save(livraison));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLivraison(@PathVariable Long id) {
        return livraisonService.findById(id)
                .map(livraison -> {
                    livraisonService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/boutique/{boutiqueId}")
    public ResponseEntity<java.util.List<Livraison>> getLivraisonsByBoutique(@PathVariable Long boutiqueId) {
        com.smboutique.api.model.Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && (current.getBoutique() == null || !current.getBoutique().getId().equals(boutiqueId))) {
            return ResponseEntity.status(403).build();
        }
        java.util.List<Livraison> livs = livraisonService.findByBoutiqueId(boutiqueId);
        return ResponseEntity.ok(livs);
    }
}
