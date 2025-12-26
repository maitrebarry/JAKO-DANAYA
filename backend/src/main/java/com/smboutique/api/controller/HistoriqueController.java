package com.smboutique.api.controller;

import com.smboutique.api.dto.ReceptionStatusDTO;
import com.smboutique.api.model.Paiement;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.PaiementService;
import com.smboutique.api.service.ReceptionService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/historique")
@CrossOrigin(origins = "*")
public class HistoriqueController {

    @Autowired
    private ReceptionService receptionService;

    @Autowired
    private PaiementService paiementService;

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.service.CommandeFournisseurService commandeFournisseurService;

    private Utilisateur getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("Utilisateur authentifié introuvable");
        }
        return utilisateurService.findByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Utilisateur authentifié introuvable"));
    }

    public static class HistoriqueItem {
        public String type; // RECEPTION or PAIEMENT
        public Long id; // id of the entity (reception or paiement)
        public String date; // formatted for display (dd/MM/yyyy HH:mm:ss)
        public String dateIso; // iso string for sorting (yyyy-MM-ddTHH:mm:ss)
        public String reference; // reception ref or paiement reference
        public Long referenceCommandeId;
        public String referenceCommande;
        public String fournisseur;
        public Double montant; // only for paiements
    }

    @GetMapping("/boutique/{boutiqueId}")
    public ResponseEntity<List<HistoriqueItem>> getHistoriqueByBoutique(@PathVariable Long boutiqueId) {
        Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && (current.getBoutique() == null || !current.getBoutique().getId().equals(boutiqueId))) {
            return ResponseEntity.status(403).build();
        }

        List<HistoriqueItem> items = new ArrayList<>();

        // Receptions status
        java.util.List<com.smboutique.api.dto.ReceptionStatusDTO> receptions = receptionService.getReceptionsStatusByBoutique(boutiqueId);
        DateTimeFormatter displayFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

        for (ReceptionStatusDTO r : receptions) {
            HistoriqueItem it = new HistoriqueItem();
            it.type = "RECEPTION";
            it.id = r.getIdReception();
            it.date = r.getDateReception() != null ? r.getDateReception().format(displayFormatter) : null;
            it.dateIso = r.getDateReception() != null ? r.getDateReception().toString() : null;
            it.reference = r.getReceptRef();
            // include commande id if present
            it.referenceCommandeId = r.getIdCommandeFournisseur();
            // fetch commande details if available
            if (r.getIdCommandeFournisseur() != null) {
                commandeFournisseurService.findById(r.getIdCommandeFournisseur()).ifPresent(cmd -> {
                    it.referenceCommande = cmd.getReference();
                    if (cmd.getFournisseur() != null) it.fournisseur = cmd.getFournisseur().getNom() + " " + cmd.getFournisseur().getPrenom();
                });
            }
            items.add(it);
        }

        // Paiements
        java.util.List<Paiement> paiements = paiementService.findByBoutiqueId(boutiqueId);
        for (Paiement p : paiements) {
            HistoriqueItem it = new HistoriqueItem();
            it.type = "PAIEMENT";
            it.id = p.getId();
            it.date = p.getDatePaie() != null ? p.getDatePaie().format(displayFormatter) : null;
            it.dateIso = p.getDatePaie() != null ? p.getDatePaie().toString() : null;
            it.reference = p.getReference();
            it.referenceCommandeId = p.getCommandeFournisseur() != null ? p.getCommandeFournisseur().getId() : null;
            it.referenceCommande = p.getCommandeFournisseur() != null ? p.getCommandeFournisseur().getReference() : null;
            it.fournisseur = p.getCommandeFournisseur() != null && p.getCommandeFournisseur().getFournisseur() != null ? p.getCommandeFournisseur().getFournisseur().getNom() + " " + p.getCommandeFournisseur().getFournisseur().getPrenom() : null;
            it.montant = p.getMontantPaye() != null ? p.getMontantPaye().doubleValue() : null;
            items.add(it);
        }

        List<HistoriqueItem> sorted = items.stream()
                .sorted(Comparator.comparing((HistoriqueItem i) -> i.dateIso == null ? LocalDateTime.MIN : LocalDateTime.parse(i.dateIso)).reversed())
                .collect(Collectors.toList());

        return ResponseEntity.ok(sorted);
    }

    private boolean isSuperAdmin(Utilisateur user) {
        if (user == null) return false;
        boolean hasRole = user.getRoles() != null && user.getRoles().stream()
                .anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
        boolean hasType = "SUPERADMIN".equalsIgnoreCase(user.getTypeUtilisateur());
        return hasRole || hasType;
    }
}
