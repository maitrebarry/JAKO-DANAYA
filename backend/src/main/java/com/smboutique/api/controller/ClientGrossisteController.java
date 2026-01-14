package com.smboutique.api.controller;

import com.smboutique.api.model.ClientGrossiste;
import com.smboutique.api.service.ClientGrossisteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/clients-grossistes")
@CrossOrigin(origins = "*")
public class ClientGrossisteController {

    @Autowired
    private ClientGrossisteService clientGrossisteService;

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
    public List<ClientGrossiste> getAllClientGrossistes() {
        return clientGrossisteService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClientGrossiste> getClientGrossisteById(@PathVariable Long id) {
        return clientGrossisteService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Autowired
    private com.smboutique.api.service.PhoneService phoneService;

    @PostMapping
    public ResponseEntity<ClientGrossiste> createClientGrossiste(@RequestBody ClientGrossiste clientGrossiste) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "CLIENT_CREER")) {
            return ResponseEntity.status(403).build();
        }

        try {
            String codePays = clientGrossiste.getCodePays();
            if (codePays == null && user.getBoutique() != null && user.getBoutique().getPays() != null) codePays = user.getBoutique().getPays().getCodeIso();
            if (clientGrossiste.getContact() != null && !clientGrossiste.getContact().isEmpty()) {
                String normalized = phoneService.validateAndNormalize(clientGrossiste.getContact(), codePays);
                clientGrossiste.setContact(normalized);
            }
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(400).<ClientGrossiste>build();
        }

        return ResponseEntity.ok(clientGrossisteService.save(clientGrossiste));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClientGrossiste> updateClientGrossiste(@PathVariable Long id, @RequestBody ClientGrossiste clientGrossisteDetails) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "CLIENT_MODIFIER")) {
            return ResponseEntity.status(403).build();
        }
        return clientGrossisteService.findById(id)
                .map(clientGrossiste -> {
                    clientGrossiste.setNom(clientGrossisteDetails.getNom());
                    clientGrossiste.setPrenom(clientGrossisteDetails.getPrenom());
                    clientGrossiste.setVille(clientGrossisteDetails.getVille());
                    try {
                        String codePays = clientGrossisteDetails.getCodePays();
                        if (codePays == null && user.getBoutique() != null && user.getBoutique().getPays() != null) codePays = user.getBoutique().getPays().getCodeIso();
                        if (clientGrossisteDetails.getContact() != null && !clientGrossisteDetails.getContact().isEmpty()) {
                            String normalized = phoneService.validateAndNormalize(clientGrossisteDetails.getContact(), codePays);
                            clientGrossiste.setContact(normalized);
                        }
                    } catch (IllegalArgumentException ex) {
                        return ResponseEntity.status(400).<ClientGrossiste>build();
                    }
                    return ResponseEntity.ok(clientGrossisteService.save(clientGrossiste));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteClientGrossiste(@PathVariable Long id) {
        com.smboutique.api.model.Utilisateur user = getCurrentUser();
        if (!isSuperAdmin(user) && !utilisateurService.hasPermission(user, "CLIENT_SUPPRIMER")) {
            return ResponseEntity.status(403).build();
        }
        return clientGrossisteService.findById(id)
                .map(clientGrossiste -> {
                    clientGrossisteService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
