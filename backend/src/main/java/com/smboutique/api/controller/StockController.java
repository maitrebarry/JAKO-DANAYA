package com.smboutique.api.controller;

import com.smboutique.api.model.Magasin;
import com.smboutique.api.model.Produit;
import com.smboutique.api.model.Stock;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.MagasinRepository;
import com.smboutique.api.service.ProduitService;
import com.smboutique.api.service.StockService;
import com.smboutique.api.dto.StockDTO;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/stocks")
@CrossOrigin(origins = "*")
public class StockController {

    @Autowired
    private StockService stockService;

    @Autowired
    private com.smboutique.api.repository.StockRepository stockRepository;

    @Autowired
    private ProduitService produitService;

    @Autowired
    private MagasinRepository magasinRepository;

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.repository.ProduitEmballageRepository produitEmballageRepository;

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
        // Determine superadmin by role membership only
        return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
    }

    private boolean hasPermission(Utilisateur user, String permissionName) {
        if (user == null) return false;
        return user.getPermissions().stream().anyMatch(p -> p.getName().equals(permissionName));
    }

    private StockDTO convertToDTO(Stock stock) {
        StockDTO dto = new StockDTO();
        dto.setId(stock.getId());
        dto.setQuantiteDisponible(stock.getQuantiteDisponible());

        if (stock.getProduit() != null) {
            StockDTO.ProduitDTO produitDTO = new StockDTO.ProduitDTO();
            produitDTO.setId(stock.getProduit().getId());
            produitDTO.setNomProduit(stock.getProduit().getNomProduit());
            produitDTO.setPrixAchat(stock.getProduit().getPrixAchat());
            produitDTO.setPrixDetail(stock.getProduit().getPrixDetail());
            produitDTO.setPrixEnGros(stock.getProduit().getPrixEnGros());
            produitDTO.setNombreUnitesParConditionnement(stock.getProduit().getNombreUnitesParConditionnement());
            // include unite information for frontends
            if (stock.getProduit().getUnite() != null) {
                StockDTO.ProduitDTO.UniteDTO u = new StockDTO.ProduitDTO.UniteDTO();
                u.setId(stock.getProduit().getUnite().getId());
                u.setLibelle(stock.getProduit().getUnite().getLibelle());
                u.setSymbole(stock.getProduit().getUnite().getSymbole());
                u.setCode(stock.getProduit().getUnite().getCode());
                produitDTO.setUnite(u);
            }
            java.util.List<com.smboutique.api.model.ProduitEmballage> embs = produitEmballageRepository.findByProduitId(stock.getProduit().getId());
            produitDTO.setEmballages(embs.stream().map(pe -> {
                com.smboutique.api.dto.ProduitEmballageDTO d = new com.smboutique.api.dto.ProduitEmballageDTO();
                d.setId(pe.getId());
                d.setNombreUnites(pe.getNombreUnites());
                d.setEstParDefaut(pe.getEstParDefaut());
                if (pe.getUnite() != null) {
                    d.setUniteId(pe.getUnite().getId());
                    d.setUniteLibelle(pe.getUnite().getLibelle());
                }
                return d;
            }).collect(java.util.stream.Collectors.toList()));
            dto.setProduit(produitDTO);
            dto.setPrixAchat(stock.getProduit().getPrixAchat());
        }

        if (stock.getMagasin() != null) {
            StockDTO.MagasinDTO magasinDTO = new StockDTO.MagasinDTO();
            magasinDTO.setId(stock.getMagasin().getId());
            magasinDTO.setNom(stock.getMagasin().getNom());
            magasinDTO.setAdresse(stock.getMagasin().getAdresse());
            dto.setMagasin(magasinDTO);
        }

        return dto;
    }

    @GetMapping
    public List<StockDTO> getAllStocks(@RequestParam(value = "level", required = false) String level,
                                        @RequestParam(value = "magasinId", required = false) Long magasinId) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "INVENTAIRE_LECTURE")) {
            return List.of(); // Return empty list if no permission
        }

        List<Stock> stocks;
        if (magasinId != null) {
            // Scoped to one specific magasin: verify it belongs to the caller's boutique
            // (superadmin may query any magasin).
            com.smboutique.api.model.Magasin magasin = magasinRepository.findById(magasinId).orElse(null);
            if (magasin == null) {
                stocks = List.of();
            } else if (!isSuperAdmin(current) && (current.getBoutique() == null || magasin.getBoutique() == null
                    || !magasin.getBoutique().getId().equals(current.getBoutique().getId()))) {
                stocks = List.of();
            } else {
                stocks = stockService.getStocksByMagasin(magasinId);
            }
        } else if (isSuperAdmin(current)) {
            stocks = stockService.getAllStocks();
        } else if (current.getBoutique() != null) {
            if ("boutique".equalsIgnoreCase(level)) {
                // explicit boutique-level request
                stocks = stockService.getBoutiqueLevelStocks(current.getBoutique().getId());
            } else {
                // default: return all stocks for the boutique (magasin + boutique)
                stocks = stockService.getStocksByProduitAndBoutique(null, current.getBoutique().getId());
            }
        } else {
            stocks = List.of();
        }
        return stocks.stream().map(this::convertToDTO).collect(java.util.stream.Collectors.toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Stock> getStockById(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "INVENTAIRE_LECTURE")) {
            return ResponseEntity.status(403).build();
        }
        Optional<Stock> stockOpt = stockService.getStockById(id);
        return stockOpt
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Stock createStock(@RequestBody Stock stock) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "INVENTAIRE_CREER")) {
            throw new RuntimeException("Permission manquante : INVENTAIRE_CREER");
        }
        if (stock.getProduit() != null && stock.getProduit().getId() != null) {
            Produit produit = produitService.findById(stock.getProduit().getId())
                    .orElseThrow(() -> new IllegalArgumentException("Produit non trouvé"));
            stock.setProduit(produit);
        }
        if (stock.getMagasin() != null && stock.getMagasin().getId() != null) {
            Magasin magasin = magasinRepository.findById(stock.getMagasin().getId())
                    .orElseThrow(() -> new IllegalArgumentException("Magasin non trouvé"));
            // Business rule: cannot create a magasin stock with an initial quantity > 0
            if (stock.getQuantiteDisponible() != null && stock.getQuantiteDisponible() > 0) {
                throw new IllegalArgumentException("Impossible de créer un stock magasin avec une quantité initiale. Utilisez l'assignation (quantite=0) ou effectuez une réception.");
            }
            stock.setMagasin(magasin);
            // set boutique for magasin stock
            stock.setBoutique(magasin.getBoutique());
            stock.setQuantiteDisponible(0);
            stock.setCostAverage(null);
            stock.setLastPurchasePrice(null);
        } else {
            // boutique-level stock: set boutique to current user's boutique and ensure present
            if (current.getBoutique() == null && !isSuperAdmin(current)) {
                throw new RuntimeException("Impossible de créer un stock boutique sans boutique propriétaire");
            }
            stock.setMagasin(null);
            stock.setBoutique(current.getBoutique());
        }
        return stockService.saveStock(stock);
    }

    public static class AssignRequest {
        public Long produitId;
        public Long magasinId;
    }

    @PostMapping("/assign")
    public ResponseEntity<?> assignProductToMagasin(@RequestBody AssignRequest req) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "INVENTAIRE_CREER")) {
            return ResponseEntity.status(403).body("Permission manquante : INVENTAIRE_CREER");
        }
        if (req.produitId == null || req.magasinId == null) {
            return ResponseEntity.badRequest().body("produitId et magasinId requis");
        }

        Produit produit = produitService.findById(req.produitId).orElse(null);
        if (produit == null) return ResponseEntity.status(404).body("Produit non trouvé");

        Magasin magasin = magasinRepository.findById(req.magasinId).orElse(null);
        if (magasin == null) return ResponseEntity.status(404).body("Magasin non trouvé");

        // Check existing stock
        if (stockService.getStockByProduitAndMagasin(req.produitId, req.magasinId).isPresent()) {
            return ResponseEntity.status(409).body("Stock pour ce produit et magasin existe déjà");
        }

        Stock s = new Stock();
        s.setProduit(produit);
        s.setMagasin(magasin);
        s.setBoutique(magasin.getBoutique());
        s.setQuantiteDisponible(0);
        s.setCostAverage(null);
        s.setLastPurchasePrice(null);

        Stock saved = stockService.saveStock(s);
        return ResponseEntity.status(201).body(saved);
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<Stock> updateStock(@PathVariable Long id, @RequestBody Stock stockDetails) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "INVENTAIRE_MODIFIER")) {
            return ResponseEntity.status(403).build();
        }
        Optional<Stock> stockOpt = stockRepository.findByIdForUpdate(id);

        return stockOpt
                .map(stock -> {
                        // Prevent manual setting of a positive initial quantity on magasin-level stocks
                    if (stock.getMagasin() != null && stockDetails.getQuantiteDisponible() != null && stockDetails.getQuantiteDisponible() > 0) {
                        // Return 400 with correct generic type
                        @SuppressWarnings("unchecked")
                        ResponseEntity<Stock> bad = (ResponseEntity<Stock>) (ResponseEntity<?>) ResponseEntity.badRequest().build();
                        return bad;
                    }
                    stock.setQuantiteDisponible(stockDetails.getQuantiteDisponible());
                    return ResponseEntity.ok(stockService.saveStock(stock));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteStock(@PathVariable Long id) {
        Optional<Stock> stockOpt = stockService.getStockById(id);

        return stockOpt
                .map(stock -> {
                    stockService.deleteStock(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}