package com.smboutique.api.controller;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.CommandeFournisseur;
import com.smboutique.api.model.Fournisseur;
import com.smboutique.api.model.Stock;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.LigneCommandeRepository;
import com.smboutique.api.model.Paiement;
import com.smboutique.api.service.PaiementService;
import java.time.LocalDateTime;
import com.smboutique.api.dto.CommandeFournisseurDTO;
import com.smboutique.api.service.CommandeFournisseurService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/api/commandes-fournisseurs")
@CrossOrigin(origins = "*")
public class CommandeFournisseurController {

    @Autowired
    private CommandeFournisseurService commandeFournisseurService;

    @Autowired
    private LigneCommandeRepository ligneCommandeRepository;

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private PaiementService paiementService;

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
        boolean hasRole = user.getRoles() != null && user.getRoles().stream()
                .anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
        boolean hasType = "SUPERADMIN".equalsIgnoreCase(user.getTypeUtilisateur());
        return hasRole || hasType;
    }

    @GetMapping
    public List<CommandeFournisseurDTO> getAllCommandeFournisseurs() {
        Utilisateur current = getCurrentUser();
        List<CommandeFournisseur> commandes;

        if (isSuperAdmin(current)) {
            commandes = commandeFournisseurService.findAll();
        } else {
            if (current.getBoutique() == null) {
                return List.of();
            }
            commandes = commandeFournisseurService.findAllByBoutiqueId(current.getBoutique().getId());
        }

        return commandes.stream().map(this::convertToDTO).collect(java.util.stream.Collectors.toList());
    }

    @GetMapping("/a-recevoir")
    public List<CommandeFournisseurDTO> getCommandesARecevoir() {
        Utilisateur current = getCurrentUser();
        List<CommandeFournisseur> commandes;

        if (isSuperAdmin(current)) {
            commandes = commandeFournisseurService.findAll();
        } else {
            if (current.getBoutique() == null) {
                return List.of();
            }
            commandes = commandeFournisseurService.findAllByBoutiqueId(current.getBoutique().getId());
        }

        List<CommandeFournisseur> commandesFiltrees = commandes.stream()
                .filter(this::hasItemsToReceive)
                .collect(java.util.stream.Collectors.toList());

        return commandesFiltrees.stream().map(this::convertToDTO).collect(java.util.stream.Collectors.toList());
    }

    @GetMapping("/boutique/{boutiqueId}")
    public List<CommandeFournisseurDTO> getAllCommandeFournisseursByBoutique(@PathVariable Long boutiqueId) {
        Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && (current.getBoutique() == null || !current.getBoutique().getId().equals(boutiqueId))) {
            return List.of();
        }
        // Return all commandes for the boutique (including fully-paid). Filtering for unpaid commandes
        // is handled by the /boutique/{boutiqueId}/a-payer endpoint (used by the payment UI select).
        List<CommandeFournisseur> commandes = commandeFournisseurService.findAllByBoutiqueId(boutiqueId);
        return commandes.stream().map(this::convertToDTO).collect(java.util.stream.Collectors.toList());
    }

    @GetMapping("/boutique/{boutiqueId}/a-payer")
    public List<CommandeFournisseurDTO> getAllCommandeFournisseursNonPayeesByBoutique(@PathVariable Long boutiqueId) {
        Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && (current.getBoutique() == null || !current.getBoutique().getId().equals(boutiqueId))) {
            return List.of();
        }
        List<CommandeFournisseur> commandes = commandeFournisseurService.findAllByBoutiqueId(boutiqueId);
        List<CommandeFournisseur> nonPayees = commandes.stream()
                .filter(cmd -> {
                    Integer paie = cmd.getPaie() != null ? cmd.getPaie() : 0;
                    Integer total = cmd.getTotal() != null ? cmd.getTotal() : 0;
                    return paie < total;
                })
                .collect(java.util.stream.Collectors.toList());
        return nonPayees.stream().map(this::convertToDTO).collect(java.util.stream.Collectors.toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CommandeFournisseur> getCommandeFournisseurById(@PathVariable Long id) {
        Utilisateur current = getCurrentUser();
        if (isSuperAdmin(current)) {
            return commandeFournisseurService.findById(id)
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        }
        if (current.getBoutique() == null) {
            return ResponseEntity.status(403).build();
        }
        return commandeFournisseurService.findByIdAndBoutiqueId(id, current.getBoutique().getId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public CommandeFournisseur createCommandeFournisseur(@RequestBody CommandeFournisseurRequest request) {
        // Get current user
        Utilisateur currentUser = getCurrentUser();
        Boutique boutique = currentUser.getBoutique();
        if (boutique == null) throw new IllegalArgumentException("Boutique non trouvée pour l'utilisateur");

        CommandeFournisseur commande = new CommandeFournisseur();
        commande.setReference(request.getReference());
        // Parse date with proper formatter for 'yyyy-MM-dd HH:mm' format
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
        commande.setDateCommande(java.time.LocalDateTime.parse(request.getDateCommande().replace('T', ' '), formatter));
        commande.setTotal((int) request.getTotal());
        commande.setUtilisateur(currentUser);
        commande.setBoutique(boutique);

        // Set fournisseur
        Fournisseur fournisseur = new Fournisseur();
        fournisseur.setId(request.getFournisseur().getId());
        commande.setFournisseur(fournisseur);

        // Create lignes
        List<com.smboutique.api.model.LigneCommande> lignes = new java.util.ArrayList<>();
        for (CommandeFournisseurRequest.ProduitSelectionne ps : request.getProduitsSelectionnes()) {
            com.smboutique.api.model.LigneCommande ligne = new com.smboutique.api.model.LigneCommande();
            Stock stock = new Stock();
            stock.setId(ps.getId_stock());
            ligne.setStock(stock);
            ligne.setQuantite(ps.getQuantite());
            ligne.setNewPrice((int) ps.getPrix());
            ligne.setCommandeFournisseur(commande);
            lignes.add(ligne);
        }
        commande.setLignes(lignes);

        return commandeFournisseurService.save(commande);
    }
    @PostMapping("/{id}/paiement")
    public ResponseEntity<CommandeFournisseur> enregistrerPaiement(@PathVariable Long id, @RequestBody PaiementRequest request) {
        Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && (current.getBoutique() == null)) {
            return ResponseEntity.status(403).build();
        }

        Long boutiqueId = isSuperAdmin(current) ? (current.getBoutique() != null ? current.getBoutique().getId() : null) : current.getBoutique().getId();
        if (boutiqueId == null) {
            return ResponseEntity.status(403).build();
        }

        java.util.Optional<CommandeFournisseur> cmdOpt = commandeFournisseurService.findByIdAndBoutiqueId(id, boutiqueId);
        if (!cmdOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        CommandeFournisseur cmd = cmdOpt.get();
        int montant = request.getMontant() != null ? request.getMontant() : 0;
        Integer paieExistante = cmd.getPaie() != null ? cmd.getPaie() : 0;
        Integer totalCommande = cmd.getTotal() != null ? cmd.getTotal() : 0;
        if (montant <= 0) {
            return ResponseEntity.badRequest().build();
        }
        if (paieExistante + montant > totalCommande) {
            return ResponseEntity.badRequest().build();
        }
        // Persist a Paiement record for historization
        try {
            Paiement paiement = new Paiement();
            paiement.setMontantPaye(montant);
            paiement.setReference(request.getReference());
            if (request.getDate() != null && !request.getDate().trim().isEmpty()) {
                try {
                    paiement.setDatePaie(LocalDateTime.parse(request.getDate()));
                } catch (Exception ex) {
                    paiement.setDatePaie(LocalDateTime.now());
                }
            } else {
                paiement.setDatePaie(LocalDateTime.now());
            }
            paiement.setCommandeFournisseur(cmd);
            paiementService.save(paiement);
        } catch (Exception e) {
            System.out.println("Warning: unable to persist paiement record: " + e.getMessage());
        }
        cmd.setPaie(paieExistante + montant);
        return ResponseEntity.ok(commandeFournisseurService.save(cmd));
    }

    @PostMapping("/{id}/reception")
    public ResponseEntity<CommandeFournisseur> enregistrerReception(@PathVariable Long id, @RequestBody ReceptionRequest request, @RequestParam Long boutiqueId) {
        return commandeFournisseurService.findByIdAndBoutiqueId(id, boutiqueId)
                .map(cmd -> {
                    if (request.getLignes() != null) {
                        request.getLignes().forEach(l -> {
                            Long ligneId = l.getLigneId();
                            if (ligneId == null) return;
                            ligneCommandeRepository.findById(ligneId).ifPresent(existing -> {
                                existing.setQuantiteLivre(l.getQuantiteLivre() != null ? l.getQuantiteLivre() : existing.getQuantiteLivre());
                                ligneCommandeRepository.save(existing);
                            });
                        });
                    }
                    return ResponseEntity.ok(cmd);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    public static class PaiementRequest {
        private Integer montant;
        private String reference;
        private String date;

        public Integer getMontant() {
            return montant;
        }

        public void setMontant(Integer montant) {
            this.montant = montant;
        }

        public String getReference() {
            return reference;
        }

        public void setReference(String reference) {
            this.reference = reference;
        }

        public String getDate() {
            return date;
        }

        public void setDate(String date) {
            this.date = date;
        }
    }

    public static class ReceptionRequest {
        private java.util.List<ReceptionLigne> lignes;

        public java.util.List<ReceptionLigne> getLignes() {
            return lignes;
        }

        public void setLignes(java.util.List<ReceptionLigne> lignes) {
            this.lignes = lignes;
        }
    }

    public static class ReceptionLigne {
        private Long ligneId;
        private Integer quantiteLivre;

        public Long getLigneId() {
            return ligneId;
        }

        public void setLigneId(Long ligneId) {
            this.ligneId = ligneId;
        }

        public Integer getQuantiteLivre() {
            return quantiteLivre;
        }

        public void setQuantiteLivre(Integer quantiteLivre) {
            this.quantiteLivre = quantiteLivre;
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<CommandeFournisseur> updateCommandeFournisseur(@PathVariable Long id, @RequestBody CommandeFournisseur commandeFournisseurDetails) {
        return commandeFournisseurService.findById(id)
                .map(commandeFournisseur -> {
                    commandeFournisseur.setReference(commandeFournisseurDetails.getReference());
                    commandeFournisseur.setDateCommande(commandeFournisseurDetails.getDateCommande());
                    commandeFournisseur.setTotal(commandeFournisseurDetails.getTotal());
                    commandeFournisseur.setPaie(commandeFournisseurDetails.getPaie());
                    commandeFournisseur.setFournisseur(commandeFournisseurDetails.getFournisseur());
                    return ResponseEntity.ok(commandeFournisseurService.save(commandeFournisseur));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCommandeFournisseur(@PathVariable Long id) {
        return commandeFournisseurService.findById(id)
                .map(commandeFournisseur -> {
                    commandeFournisseurService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private boolean hasItemsToReceive(CommandeFournisseur commande) {
        return commande.getLignes().stream()
                .anyMatch(ligne -> ligne.getQuantite() > (ligne.getQuantiteLivre() != null ? ligne.getQuantiteLivre() : 0));
    }

    private CommandeFournisseurDTO convertToDTO(CommandeFournisseur commande) {
        CommandeFournisseurDTO dto = new CommandeFournisseurDTO();
        dto.setId(commande.getId());
        dto.setReference(commande.getReference());
        dto.setDateCommande(commande.getDateCommande().toString());
        dto.setTotal(commande.getTotal());

        // Set fournisseur
        if (commande.getFournisseur() != null) {
            CommandeFournisseurDTO.FournisseurDTO fournisseurDTO = new CommandeFournisseurDTO.FournisseurDTO();
            fournisseurDTO.setId(commande.getFournisseur().getId());
            fournisseurDTO.setPrenom(commande.getFournisseur().getPrenom());
            fournisseurDTO.setNom(commande.getFournisseur().getNom());
            dto.setFournisseur(fournisseurDTO);
        }

        // Calculate percentages (reused logic)
        dto.setPourcentageRecu(calculatePourcentageRecu(commande));
        double pourcentagePaye = calculatePourcentagePaye(commande, dto.getTotal());
        dto.setPourcentagePaye(pourcentagePaye);
        dto.setMontantPaye(commande.getPaie() != null ? commande.getPaie() : 0);

        return dto;
    }

    private double calculatePourcentageRecu(CommandeFournisseur commande) {
        if (commande.getLignes() == null || commande.getLignes().isEmpty()) {
            return 0.0;
        }

        int totalCommande = commande.getLignes().stream()
                .mapToInt(com.smboutique.api.model.LigneCommande::getQuantite)
                .sum();

        int totalLivre = commande.getLignes().stream()
                .mapToInt(ligne -> ligne.getQuantiteLivre() != null ? ligne.getQuantiteLivre() : 0)
                .sum();

        if (totalCommande == 0) {
            return 0.0;
        }

        return (double) totalLivre / totalCommande * 100.0;
    }

    private double calculatePourcentagePaye(CommandeFournisseur commande, double total) {
        if (total == 0.0) return 0.0;
        Integer paie = commande.getPaie() != null ? commande.getPaie() : 0;
        return (double) paie / total * 100.0;
    }
}