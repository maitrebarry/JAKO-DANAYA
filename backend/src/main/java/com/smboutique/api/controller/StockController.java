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
    private ProduitService produitService;

    @Autowired
    private MagasinRepository magasinRepository;

    @Autowired
    private UtilisateurService utilisateurService;

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
        boolean hasRole = user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
        boolean hasType = "SUPERADMIN".equalsIgnoreCase(user.getTypeUtilisateur());
        return hasRole || hasType;
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
            dto.setProduit(produitDTO);
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
    public List<StockDTO> getAllStocks() {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "INVENTAIRE_LECTURE")) {
            return List.of(); // Return empty list if no permission
        }
        System.out.println("Current user: " + current.getEmail() + ", Boutique: " + (current.getBoutique() != null ? current.getBoutique().getId() : "null"));
        
        List<Stock> stocks;
        if (isSuperAdmin(current)) {
            System.out.println("User is superadmin, getting all stocks");
            stocks = stockService.getAllStocks();
        } else if (current.getBoutique() != null) {
            System.out.println("Getting stocks for boutique: " + current.getBoutique().getId());
            stocks = stockService.getStocksByProduitAndBoutique(null, current.getBoutique().getId());
            System.out.println("Found " + stocks.size() + " stocks");
        } else {
            System.out.println("User has no boutique");
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
            stock.setMagasin(magasin);
        }
        return stockService.saveStock(stock);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Stock> updateStock(@PathVariable Long id, @RequestBody Stock stockDetails) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "INVENTAIRE_MODIFIER")) {
            return ResponseEntity.status(403).build();
        }
        Optional<Stock> stockOpt = stockService.getStockById(id);

        return stockOpt
                .map(stock -> {
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