package com.smboutique.api.controller;

import com.smboutique.api.model.*;
import com.smboutique.api.repository.StockRepository;
import com.smboutique.api.service.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@RestController
@CrossOrigin(origins = "*")
public class VenteLivraisonController {

    @Autowired
    private VenteService venteService;

    @Autowired
    private LigneVenteService ligneVenteService;

    @Autowired
    private StockService stockService;

    @Autowired
    private StockRepository stockRepository;

    @Autowired
    private LivraisonService livraisonService;

    @Autowired
    private LigneLivraisonService ligneLivraisonService;

    @Autowired
    private MouvementService mouvementService;

    @Autowired
    private UtilisateurService utilisateurService;

    private com.smboutique.api.model.Utilisateur getCurrentUser() {
        org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
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

    private boolean hasPermission(Utilisateur user, String permissionName) {
        if (user == null) return false;
        return user.getPermissions().stream().anyMatch(p -> p.getName().equals(permissionName));
    }

    public static class LivraisonLineRequest {
        public Long ligneVenteId;
        public Long stockId;
        public Integer quantite;
        // optional: quantity expressed in conditionnement (e.g., packs)
        public Integer quantiteConditionnement;
    }

    public static class VenteLivraisonRequest {
        public String reference;
        public List<LivraisonLineRequest> lignes = new ArrayList<>();
    }

    @PostMapping("/api/ventes/{venteId}/livraisons")
    @Transactional
    public ResponseEntity<?> deliverVente(@PathVariable Long venteId, @RequestBody VenteLivraisonRequest request) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "LIVRAISON_ECRITURE") && !isSuperAdmin(user)) {
            return ResponseEntity.status(403).build();
        }

        Optional<Vente> venteOpt = venteService.findById(venteId);
        if (!venteOpt.isPresent()) return ResponseEntity.notFound().build();
        Vente vente = venteOpt.get();
        // If vente has an utilisateur and boutique, ensure same boutique
        if (vente.getUtilisateur() != null && vente.getUtilisateur().getBoutique() != null) {
            if (!vente.getUtilisateur().getBoutique().getId().equals(user.getBoutique().getId())) {
                return ResponseEntity.status(403).body("Vente belongs to another boutique");
            }
        }

        try {
            // First pass: validate all lines without saving anything to ensure atomicity
            for (LivraisonLineRequest lr : request.lignes) {
                if (lr.quantite == null || lr.quantite <= 0) continue;
                LigneVente lc = ligneVenteService.findById(lr.ligneVenteId).orElseThrow(() -> new RuntimeException("LigneVente introuvable"));
                if (lc.getVente() == null || !lc.getVente().getId().equals(venteId)) throw new RuntimeException("LigneVente ne correspond pas à la vente");

                Stock requested = stockService.getStockById(lr.stockId).orElseThrow(() -> new RuntimeException("Stock introuvable"));
                // Ensure requested stock belongs to the user's boutique if it's a magasin stock
                if (requested.getMagasin() != null && requested.getMagasin().getBoutique() != null && !requested.getMagasin().getBoutique().getId().equals(user.getBoutique().getId())) {
                    throw new RuntimeException("Stock hors boutique utilisateur");
                }

                // Business rule: delivery decrements boutique stock. If a magasin stock was provided, resolve the corresponding boutique-level stock for THIS boutique.
                Stock stock = requested;
                if (requested.getMagasin() != null) {
                    Long prodId = requested.getProduit() != null ? requested.getProduit().getId() : null;
                    if (prodId == null) throw new RuntimeException("Produit introuvable sur le stock fourni");
                    // try to find boutique-level stock for THIS user's boutique and product
                    java.util.List<Stock> candidates = stockService.getStocksByProduitAndBoutique(prodId, user.getBoutique().getId());
                    stock = candidates.stream().filter(s -> s.getMagasin() == null).findFirst()
                            .orElseThrow(() -> new RuntimeException("Stock boutique introuvable pour ce produit dans la boutique de l'utilisateur"));
                }

                Integer available = stock.getQuantiteDisponible() != null ? stock.getQuantiteDisponible() : 0;
                if (available < lr.quantite) {
                    throw new RuntimeException("Stock insuffisant pour le produit " + lc.getProduit().getId());
                }
            }

            // All validations passed — perform persistence in a second pass
            Livraison liv = new Livraison();
            liv.setDateLivraison(LocalDateTime.now());
            liv.setReference(request.reference != null ? request.reference : "LV-" + System.currentTimeMillis());
            Livraison savedLiv = livraisonService.save(liv);

            for (LivraisonLineRequest lr : request.lignes) {
                if (lr.quantite == null || lr.quantite <= 0) continue;
                LigneVente lc = ligneVenteService.findById(lr.ligneVenteId).orElseThrow(() -> new RuntimeException("LigneVente introuvable"));

                Stock requested = stockService.getStockById(lr.stockId).orElseThrow(() -> new RuntimeException("Stock introuvable"));
                // Ensure requested stock belongs to the user's boutique if it's a magasin stock
                if (requested.getMagasin() != null && requested.getMagasin().getBoutique() != null && !requested.getMagasin().getBoutique().getId().equals(user.getBoutique().getId())) {
                    throw new RuntimeException("Stock hors boutique utilisateur");
                }

                Stock stock = requested;
                if (requested.getMagasin() != null) {
                    Long prodId = requested.getProduit() != null ? requested.getProduit().getId() : null;
                    if (prodId == null) throw new RuntimeException("Produit introuvable sur le stock fourni");
                    // try to find boutique-level stock for THIS user's boutique and product
                    java.util.List<Stock> candidates = stockService.getStocksByProduitAndBoutique(prodId, user.getBoutique().getId());
                    stock = candidates.stream().filter(s -> s.getMagasin() == null).findFirst()
                            .orElseThrow(() -> new RuntimeException("Stock boutique introuvable pour ce produit dans la boutique de l'utilisateur"));
                }

                // compute requested qty in units
                int qtyUnits = 0;
                if (lr.quantite != null && lr.quantite > 0) qtyUnits = lr.quantite;
                else if (lr.quantiteConditionnement != null && lr.quantiteConditionnement > 0) {
                    Integer mul = lc.getProduit() != null && lc.getProduit().getNombreUnitesParConditionnement() != null ? lc.getProduit().getNombreUnitesParConditionnement() : 1;
                    qtyUnits = lr.quantiteConditionnement * mul;
                }

                // decrement stock (under lock to avoid lost updates)
                if (stock.getId() != null) {
                    stock = stockRepository.findByIdForUpdate(stock.getId()).orElse(stock);
                }
                Integer available = stock.getQuantiteDisponible() != null ? stock.getQuantiteDisponible() : 0;
                if (available < qtyUnits) throw new RuntimeException("Stock insuffisant");
                stock.setQuantiteDisponible(available - qtyUnits);
                stockService.saveStock(stock);

                // create ligne livraison
                LigneLivraison ligneLivraison = new LigneLivraison();
                ligneLivraison.setLivraison(savedLiv);
                ligneLivraison.setQuantiteRecu(qtyUnits);
                ligneLivraison.setProduit(lc.getProduit());
                ligneLivraisonService.save(ligneLivraison);

                // update qte_livre on ligne vente
                Integer qteLivreActuelle = lc.getQuantiteLivre() != null ? lc.getQuantiteLivre() : 0;
                lc.setQuantiteLivre(qteLivreActuelle + qtyUnits);
                ligneVenteService.save(lc);

                // create mouvement (SORTIE)
                Mouvement mv = new Mouvement();
                mv.setLigneVente(lc);
                mv.setProduit(lc.getProduit());
                mv.setQuantite(qtyUnits);
                mv.setTypeMouvement("SORTIE");
                mv.setDateMouvement(LocalDateTime.now());
                mv.setStock(stock);
                mv.setBoutique(user.getBoutique());
                mouvementService.save(mv);
            }

            return ResponseEntity.ok(savedLiv);
        } catch (Exception e) {
            // ensure rollback and return an error response so tests can assert status
            org.springframework.transaction.interceptor.TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
            return ResponseEntity.status(500).body(e.getMessage());
        }
    }
}
