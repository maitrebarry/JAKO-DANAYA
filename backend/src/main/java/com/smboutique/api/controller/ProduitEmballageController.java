package com.smboutique.api.controller;

import com.smboutique.api.dto.ProduitEmballageDTO;
import com.smboutique.api.dto.ProduitEmballageRequest;
import com.smboutique.api.model.Produit;
import com.smboutique.api.model.ProduitEmballage;
import com.smboutique.api.model.Unite;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.LigneVenteRepository;
import com.smboutique.api.repository.ProduitEmballageRepository;
import com.smboutique.api.service.ProduitEmballageService;
import com.smboutique.api.service.ProduitService;
import com.smboutique.api.service.UniteService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/produits/{produitId}/emballages")
@CrossOrigin(origins = "*")
public class ProduitEmballageController {

    @Autowired
    private ProduitEmballageService produitEmballageService;

    @Autowired
    private ProduitEmballageRepository produitEmballageRepository;

    @Autowired
    private ProduitService produitService;

    @Autowired
    private UniteService uniteService;

    @Autowired
    private LigneVenteRepository ligneVenteRepository;

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
        return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
    }

    private boolean hasPermission(Utilisateur user, String permissionName) {
        return utilisateurService.hasPermission(user, permissionName);
    }

    @GetMapping
    public ResponseEntity<?> list(@PathVariable Long produitId) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "PRODUIT_LECTURE") && !isSuperAdmin(current)) {
            return ResponseEntity.status(403).body(Map.of("error", "Permission manquante : PRODUIT_LECTURE"));
        }
        Optional<Produit> produitOpt = produitService.findById(produitId);
        if (produitOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(produitEmballageService.findByProduitId(produitId));
    }

    @PostMapping
    public ResponseEntity<?> create(@PathVariable Long produitId, @RequestBody ProduitEmballageRequest req) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "PRODUIT_MODIFIER") && !isSuperAdmin(current)) {
            return ResponseEntity.status(403).body(Map.of("error", "Permission manquante : PRODUIT_MODIFIER"));
        }
        Optional<Produit> produitOpt = produitService.findById(produitId);
        if (produitOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        if (req.getUniteId() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "uniteId requis"));
        }
        if (req.getNombreUnites() == null || req.getNombreUnites() < 1) {
            return ResponseEntity.badRequest().body(Map.of("error", "nombreUnites doit être >= 1"));
        }
        Optional<Unite> uniteOpt = uniteService.findById(req.getUniteId());
        if (uniteOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Unité introuvable"));
        }
        try {
            ProduitEmballageDTO dto = produitEmballageService.create(produitOpt.get(), uniteOpt.get(), req.getNombreUnites(), Boolean.TRUE.equals(req.getEstParDefaut()));
            return ResponseEntity.ok(dto);
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cet emballage existe déjà pour ce produit"));
        }
    }

    @PutMapping("/{emballageId}")
    public ResponseEntity<?> update(@PathVariable Long produitId, @PathVariable Long emballageId, @RequestBody ProduitEmballageRequest req) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "PRODUIT_MODIFIER") && !isSuperAdmin(current)) {
            return ResponseEntity.status(403).body(Map.of("error", "Permission manquante : PRODUIT_MODIFIER"));
        }
        Optional<Produit> produitOpt = produitService.findById(produitId);
        if (produitOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Optional<ProduitEmballage> emballageOpt = produitEmballageRepository.findByIdAndProduitId(emballageId, produitId);
        if (emballageOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        if (req.getUniteId() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "uniteId requis"));
        }
        if (req.getNombreUnites() == null || req.getNombreUnites() < 1) {
            return ResponseEntity.badRequest().body(Map.of("error", "nombreUnites doit être >= 1"));
        }
        Optional<Unite> uniteOpt = uniteService.findById(req.getUniteId());
        if (uniteOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Unité introuvable"));
        }
        try {
            ProduitEmballageDTO dto = produitEmballageService.update(produitOpt.get(), emballageOpt.get(), uniteOpt.get(), req.getNombreUnites(), Boolean.TRUE.equals(req.getEstParDefaut()));
            return ResponseEntity.ok(dto);
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cet emballage existe déjà pour ce produit"));
        }
    }

    @DeleteMapping("/{emballageId}")
    public ResponseEntity<?> delete(@PathVariable Long produitId, @PathVariable Long emballageId) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "PRODUIT_MODIFIER") && !isSuperAdmin(current)) {
            return ResponseEntity.status(403).body(Map.of("error", "Permission manquante : PRODUIT_MODIFIER"));
        }
        Optional<Produit> produitOpt = produitService.findById(produitId);
        if (produitOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Optional<ProduitEmballage> emballageOpt = produitEmballageRepository.findByIdAndProduitId(emballageId, produitId);
        if (emballageOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        if (ligneVenteRepository.existsByEmballageId(emballageId)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cet emballage a déjà été utilisé dans une vente, il ne peut pas être supprimé."));
        }
        produitEmballageService.delete(produitOpt.get(), emballageOpt.get());
        return ResponseEntity.ok().build();
    }
}
