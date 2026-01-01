package com.smboutique.api.controller;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.BoutiqueService;
import com.smboutique.api.service.UtilisateurService;
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

    @PostMapping
    @PreAuthorize("hasRole('SUPERADMIN')")
    public Boutique createBoutique(@RequestParam("nom") String nom,
                                   @RequestParam("quartier") String quartier,
                                   @RequestParam("adresse") String adresse,
                                   @RequestParam("telephone") String telephone,
                                   @RequestParam(value = "logo", required = false) MultipartFile logo) throws IOException {
        Boutique boutique = new Boutique();
        boutique.setNom(nom);
        boutique.setQuartier(quartier);
        boutique.setAdresse(adresse);
        boutique.setTelephone(telephone);

        if (logo != null && !logo.isEmpty()) {
            String fileName = UUID.randomUUID().toString() + "_" + logo.getOriginalFilename();
            Path uploadPath = Paths.get(UPLOAD_DIR);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
            Files.write(uploadPath.resolve(fileName), logo.getBytes());
            boutique.setLogo("/" + UPLOAD_DIR + fileName);
        }

        return boutiqueService.save(boutique);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<Boutique> updateBoutique(@PathVariable Long id,
                                                   @RequestParam("nom") String nom,
                                                   @RequestParam("quartier") String quartier,
                                                   @RequestParam("adresse") String adresse,
                                                   @RequestParam("telephone") String telephone,
                                                   @RequestParam(value = "logo", required = false) MultipartFile logo) throws IOException {
        return boutiqueService.findById(id)
                .map(boutique -> {
                    boutique.setNom(nom);
                    boutique.setQuartier(quartier);
                    boutique.setAdresse(adresse);
                    boutique.setTelephone(telephone);

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

                    return ResponseEntity.ok(boutiqueService.save(boutique));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<Void> deleteBoutique(@PathVariable Long id) {
        return boutiqueService.findById(id)
                .map(boutique -> {
                    boutiqueService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
