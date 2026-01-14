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

    private boolean hasPermission(Utilisateur user, String permissionName) {
        if (user == null) return false;
        return user.getPermissions().stream().anyMatch(p -> p.getName().equals(permissionName));
    }

    private boolean isSuperAdmin(Utilisateur user) {
        if (user == null) return false;
        // Determine superadmin by role membership only
        return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
    }

    @GetMapping
    public List<Fournisseur> getAllFournisseurs() {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "FOURNISSEUR_LECTURE")) {
            return List.of(); // Return empty list if no permission
        }
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
        if (!hasPermission(current, "FOURNISSEUR_LECTURE")) {
            return ResponseEntity.status(403).build();
        }
        Optional<Fournisseur> fournisseurOpt = isSuperAdmin(current)
                ? fournisseurService.findById(id)
                : (current.getBoutique() == null ? Optional.empty() : fournisseurService.findByIdAndBoutiqueId(id, current.getBoutique().getId()));

        return fournisseurOpt
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Autowired
    private com.smboutique.api.service.PhoneService phoneService;

    @PostMapping
    public Fournisseur createFournisseur(@RequestBody Fournisseur fournisseur) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "FOURNISSEUR_CREER")) {
            throw new RuntimeException("Permission manquante : FOURNISSEUR_CREER");
        }
        if (!isSuperAdmin(current)) {
            fournisseur.setBoutique(current.getBoutique());
        } else if (fournisseur.getBoutique() != null && fournisseur.getBoutique().getId() != null) {
            Boutique boutique = boutiqueService.findById(fournisseur.getBoutique().getId())
                    .orElseThrow(() -> new IllegalArgumentException("Boutique non trouvée"));
            fournisseur.setBoutique(boutique);
        }

        // Validate phone
        try {
            String codePays = fournisseur.getCodePays();
            if (codePays == null && fournisseur.getBoutique() != null && fournisseur.getBoutique().getPays() != null) {
                codePays = fournisseur.getBoutique().getPays().getCodeIso();
            }
            if (fournisseur.getContact() != null && !fournisseur.getContact().isEmpty()) {
                String normalized = phoneService.validateAndNormalize(fournisseur.getContact(), codePays);
                fournisseur.setContact(normalized);
            }
        } catch (IllegalArgumentException ex) {
            throw new RuntimeException("Téléphone invalide: " + ex.getMessage());
        }

        return fournisseurService.save(fournisseur);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Fournisseur> updateFournisseur(@PathVariable Long id, @RequestBody Fournisseur fournisseurDetails) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "FOURNISSEUR_MODIFIER")) {
            return ResponseEntity.status(403).build();
        }
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
                    fournisseur.setVille(fournisseurDetails.getVille());

                    // Validate phone
                    try {
                        String codePays = fournisseurDetails.getCodePays();
                        if (codePays == null && fournisseur.getBoutique() != null && fournisseur.getBoutique().getPays() != null) {
                            codePays = fournisseur.getBoutique().getPays().getCodeIso();
                        }
                        if (fournisseurDetails.getContact() != null && !fournisseurDetails.getContact().isEmpty()) {
                            String normalized = phoneService.validateAndNormalize(fournisseurDetails.getContact(), codePays);
                            fournisseur.setContact(normalized);
                        }
                    } catch (IllegalArgumentException ex) {
                        return ResponseEntity.status(400).<Fournisseur>build();
                    }

                    return ResponseEntity.ok(fournisseurService.save(fournisseur));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFournisseur(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        if (!hasPermission(current, "FOURNISSEUR_SUPPRIMER")) {
            return ResponseEntity.status(403).build();
        }
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
