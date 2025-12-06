package com.smboutique.api.controller;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.Fournisseur;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.BoutiqueService;
import com.smboutique.api.service.FournisseurService;
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
@RequestMapping("/api/fournisseurs")
@CrossOrigin(origins = "*")
public class FournisseurController {

    @Autowired
    private FournisseurService fournisseurService;

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private BoutiqueService boutiqueService;

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

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE')")
    public List<Fournisseur> getAllFournisseurs() {
        Utilisateur current = getCurrentUser();
        if (isSuperAdmin(current)) {
            return fournisseurService.findAll();
        }
        if (current.getBoutique() == null) {
            return List.of();
        }
        return fournisseurService.findAllByBoutiqueId(current.getBoutique().getId());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Fournisseur> getFournisseurById(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        Optional<Fournisseur> fournisseurOpt = isSuperAdmin(current)
                ? fournisseurService.findById(id)
                : (current.getBoutique() == null ? Optional.empty() : fournisseurService.findByIdAndBoutiqueId(id, current.getBoutique().getId()));

        return fournisseurOpt
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE')")
    public Fournisseur createFournisseur(@RequestBody Fournisseur fournisseur) {
        Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current)) {
            fournisseur.setBoutique(current.getBoutique());
        } else if (fournisseur.getBoutique() != null && fournisseur.getBoutique().getId() != null) {
            Boutique boutique = boutiqueService.findById(fournisseur.getBoutique().getId())
                    .orElseThrow(() -> new IllegalArgumentException("Boutique non trouvée"));
            fournisseur.setBoutique(boutique);
        }
        return fournisseurService.save(fournisseur);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Fournisseur> updateFournisseur(@PathVariable Long id, @RequestBody Fournisseur fournisseurDetails) {
        Utilisateur current = getCurrentUser();
        Optional<Fournisseur> fournisseurOpt = isSuperAdmin(current)
                ? fournisseurService.findById(id)
                : (current.getBoutique() == null ? Optional.empty() : fournisseurService.findByIdAndBoutiqueId(id, current.getBoutique().getId()));

        return fournisseurOpt
                .map(fournisseur -> {
                    if (isSuperAdmin(current)) {
                        if (fournisseurDetails.getBoutique() != null && fournisseurDetails.getBoutique().getId() != null) {
                            Boutique boutique = boutiqueService.findById(fournisseurDetails.getBoutique().getId())
                                    .orElseThrow(() -> new IllegalArgumentException("Boutique non trouvée"));
                            fournisseur.setBoutique(boutique);
                        }
                    } else if (current.getBoutique() != null) {
                        fournisseur.setBoutique(current.getBoutique());
                    }

                    fournisseur.setNom(fournisseurDetails.getNom());
                    fournisseur.setPrenom(fournisseurDetails.getPrenom());
                    fournisseur.setContact(fournisseurDetails.getContact());
                    fournisseur.setVille(fournisseurDetails.getVille());
                    return ResponseEntity.ok(fournisseurService.save(fournisseur));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFournisseur(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        Optional<Fournisseur> fournisseurOpt = isSuperAdmin(current)
                ? fournisseurService.findById(id)
                : (current.getBoutique() == null ? Optional.empty() : fournisseurService.findByIdAndBoutiqueId(id, current.getBoutique().getId()));

        return fournisseurOpt
                .map(fournisseur -> {
                    fournisseurService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
