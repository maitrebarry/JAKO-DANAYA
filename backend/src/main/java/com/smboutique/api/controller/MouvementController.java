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
    public List<Mouvement> getAllMouvements() {
        return mouvementService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Mouvement> getMouvementById(@PathVariable Long id) {
        return mouvementService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
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
