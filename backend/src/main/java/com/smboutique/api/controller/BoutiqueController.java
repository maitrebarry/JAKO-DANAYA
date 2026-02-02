package com.smboutique.api.controller;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.BoutiqueService;
import com.smboutique.api.service.UtilisateurService;
import com.smboutique.api.model.Pays;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/boutiques")
@CrossOrigin(origins = "*")
public class BoutiqueController {

    @Autowired
    private BoutiqueService boutiqueService;

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.repository.PaysRepository paysRepository;

    private static final String UPLOAD_DIR = "uploads/logos/";

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

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE')")
    public List<Boutique> getAllBoutiques() {
        Utilisateur current = getCurrentUser();
        if (isSuperAdmin(current)) {
            return boutiqueService.findAll();
        }
        if (current.getBoutique() == null) {
            return List.of();
        }
        return List.of(current.getBoutique());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE')")
    public ResponseEntity<Boutique> getBoutiqueById(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        return boutiqueService.findById(id)
                .map(boutique -> {
                    if (!isSuperAdmin(current)) {
                        if (current.getBoutique() == null || !current.getBoutique().getId().equals(boutique.getId())) {
                            return ResponseEntity.status(403).<Boutique>build();
                        }
                    }
                    return ResponseEntity.ok(boutique);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @Autowired
    private com.smboutique.api.service.PhoneService phoneService;

    @Autowired
    private com.smboutique.api.service.PaysSyncService paysSyncService;

    @PostMapping
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> createBoutique(@RequestParam(value = "nom", required = false) String nom,
                                   @RequestParam(value = "quartier", required = false) String quartier,
                                   @RequestParam(value = "adresse", required = false) String adresse,
                                   @RequestParam(value = "indicatif", required = false) String indicatif,
                                   @RequestParam(value = "codePays", required = false) String codePays,
                                   @RequestParam(value = "logo", required = false) MultipartFile logo) throws IOException {
        // Ensure minimal required fields are present
        if (nom == null || nom.trim().isEmpty() || adresse == null || adresse.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Veuillez remplir au moins le nom et l'adresse.");
        }

        Boutique boutique = new Boutique();
        boutique.setNom(nom);
        boutique.setQuartier(quartier);
        boutique.setAdresse(adresse);

        // Normalize phone using provided codePays or default ML
        String cp = (codePays != null && !codePays.isEmpty()) ? codePays.toUpperCase() : (paysRepository.findByCodeIso("ML").map(p -> p.getCodeIso()).orElse("ML"));

        // Set indicatif if provided
        if (indicatif != null && !indicatif.trim().isEmpty()) {
            String indClean = indicatif.replaceAll("\\s", "");
            boutique.setIndicatif(indClean.startsWith("+") ? indClean : "+" + indClean);
        }

        if (logo != null && !logo.isEmpty()) {
            String fileName = UUID.randomUUID().toString() + "_" + logo.getOriginalFilename();
            Path uploadPath = Paths.get(UPLOAD_DIR);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
            Files.write(uploadPath.resolve(fileName), logo.getBytes());
            boutique.setLogo("/" + UPLOAD_DIR + fileName);
        }

        // if codePays provided, associate it (create if unknown)
        if (codePays != null && !codePays.isEmpty()) {
            var p = paysRepository.findByCodeIso(codePays.toUpperCase())
                    .orElseGet(() -> paysSyncService.ensurePays(codePays.toUpperCase()));
            boutique.setPays(p);
        }

        return ResponseEntity.ok(boutiqueService.save(boutique));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> updateBoutique(@PathVariable Long id,
                                                   @RequestParam("nom") String nom,
                                                   @RequestParam("quartier") String quartier,
                                                   @RequestParam("adresse") String adresse,
                                                   @RequestParam(value = "indicatif", required = false) String indicatif,
                                                   @RequestParam(value = "codePays", required = false) String codePays,
                                                   @RequestParam(value = "logo", required = false) MultipartFile logo) throws IOException {
        return boutiqueService.findById(id)
                .map(boutique -> {
                    boutique.setNom(nom);
                    boutique.setQuartier(quartier);
                    boutique.setAdresse(adresse);

                    // Set indicatif if provided
                    if (indicatif != null && !indicatif.trim().isEmpty()) {
                        String indClean = indicatif.replaceAll("\\s", "");
                        boutique.setIndicatif(indClean.startsWith("+") ? indClean : "+" + indClean);
                    } else {
                        boutique.setIndicatif(null);
                    }

                    if (logo != null && !logo.isEmpty()) {
                        try {
                            String fileName = UUID.randomUUID().toString() + "_" + logo.getOriginalFilename();
                            Path uploadPath = Paths.get(UPLOAD_DIR);
                            if (!Files.exists(uploadPath)) {
                                Files.createDirectories(uploadPath);
                            }
                            Files.write(uploadPath.resolve(fileName), logo.getBytes());
                            boutique.setLogo("/" + UPLOAD_DIR + fileName);
                        } catch (IOException e) {
                            throw new RuntimeException(e);
                        }
                    }

                    if (codePays != null && !codePays.isEmpty()) {
                        var p = paysRepository.findByCodeIso(codePays.toUpperCase())
                                .orElseGet(() -> paysSyncService.ensurePays(codePays.toUpperCase()));
                        boutique.setPays(p);
                        // also save the indicatif if available
                        if (p != null && p.getIndicatif() != null) {
                            boutique.setIndicatif(p.getIndicatif().startsWith("+") ? p.getIndicatif() : "+" + p.getIndicatif());
                        }
                    }
                    // if indicatif was supplied explicitly, store it
                    if (indicatif != null && !indicatif.trim().isEmpty()) {
                        String indClean = indicatif.replaceAll("\\s", "");
                        boutique.setIndicatif(indClean.startsWith("+") ? indClean : "+" + indClean);
                    }

                    return ResponseEntity.ok(boutiqueService.save(boutique));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<?> deleteBoutique(@PathVariable Long id) {
        return boutiqueService.findById(id)
                .map(boutique -> {
                    try {
                        boutiqueService.deleteById(id);
                        return ResponseEntity.ok().<Void>build();
                    } catch (org.springframework.dao.DataIntegrityViolationException dive) {
                        // Can't delete due to FK constraints - return actionable 409 with message
                        String msg = "Impossible de supprimer la boutique : il existe des données liées (ventes, commandes, paiements, etc.). Supprimez d'abord les dépendances ou contactez l'administrateur.";
                        org.slf4j.LoggerFactory.getLogger(BoutiqueController.class).warn("Failed to delete boutique id={}. Reason: {}", id, dive.getMessage());
                        return ResponseEntity.status(409).body(java.util.Map.of("error", msg));
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
