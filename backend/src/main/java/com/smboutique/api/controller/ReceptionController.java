package com.smboutique.api.controller;

import com.smboutique.api.dto.ReceptionDTO;
import com.smboutique.api.dto.ReceptionListDTO;
import com.smboutique.api.model.Reception;
import com.smboutique.api.model.LigneCommande;
import com.smboutique.api.model.LigneReception;
import com.smboutique.api.model.Produit;
import com.smboutique.api.model.Stock;
import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.CommandeFournisseur;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.BoutiqueService;
import com.smboutique.api.service.ReceptionService;
import com.smboutique.api.service.CommandeFournisseurService;
import com.smboutique.api.service.LigneReceptionService;
import com.smboutique.api.service.StockService;
import com.smboutique.api.service.ProduitService;
import com.smboutique.api.service.UtilisateurService;
import com.smboutique.api.repository.LigneCommandeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.List;
import java.util.ArrayList;
import java.util.Optional;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/api/receptions")
@CrossOrigin(origins = "*")
public class ReceptionController {

    @Autowired
    private ReceptionService receptionService;

    @Autowired
    private CommandeFournisseurService commandeFournisseurService;

    @Autowired
    private LigneReceptionService ligneReceptionService;

    @Autowired
    private StockService stockService;

    @Autowired
    private ProduitService produitService;

    @Autowired
    private BoutiqueService boutiqueService;

    @Autowired
    private LigneCommandeRepository ligneCommandeRepository;

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

    @GetMapping
    public List<Reception> getAllReceptions() {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "RECEPTION_LECTURE")) {
            return List.of(); // Return empty list if no permission
        }
        if (isSuperAdmin(user)) {
            return receptionService.findAll();
        } else {
            return receptionService.findUnfinishedReceptionsByBoutiqueId(user.getBoutique().getId());
        }
    }

    @GetMapping("/unfinished")
    public List<ReceptionListDTO> getUnfinishedReceptions() {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "RECEPTION_LECTURE")) {
            return List.of(); // Return empty list if no permission
        }
        if (isSuperAdmin(user)) {
            return receptionService.findUnfinishedReceptionsList();
        } else {
            return receptionService.findUnfinishedReceptionsListByBoutiqueId(user.getBoutique().getId());
        }
    }

    @GetMapping("/finished")
    public List<ReceptionListDTO> getFinishedReceptions() {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "RECEPTION_LECTURE")) {
            return List.of(); // Return empty list if no permission
        }
        if (isSuperAdmin(user)) {
            return receptionService.findFinishedReceptionsList();
        } else {
            return receptionService.findFinishedReceptionsListByBoutiqueId(user.getBoutique().getId());
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Reception> getReceptionById(@PathVariable Long id) {
        return receptionService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Reception createReception(@RequestBody Reception reception) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "RECEPTION_ECRITURE")) {
            throw new RuntimeException("Permission insuffisante pour créer une réception");
        }
        // Assigner automatiquement la boutique de l'utilisateur connecté
        reception.setBoutique(user.getBoutique());
        return receptionService.save(reception);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Reception> updateReception(@PathVariable Long id, @RequestBody Reception receptionDetails) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "RECEPTION_ECRITURE")) {
            return ResponseEntity.status(403).build(); // Forbidden
        }

        Optional<Reception> receptionOpt = receptionService.findById(id);
        if (receptionOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Reception reception = receptionOpt.get();

        // Vérifier que la réception appartient à la boutique de l'utilisateur (sauf superadmin)
        if (!isSuperAdmin(user) && !reception.getBoutique().getId().equals(user.getBoutique().getId())) {
            return ResponseEntity.status(403).build(); // Forbidden
        }

        reception.setReference(receptionDetails.getReference());
        reception.setDateReception(receptionDetails.getDateReception());
        reception.setCommandeFournisseur(receptionDetails.getCommandeFournisseur());
        return ResponseEntity.ok(receptionService.save(reception));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteReception(@PathVariable Long id) {
        return receptionService.findById(id)
                .map(reception -> {
                    receptionService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/detail")
    public ResponseEntity<ReceptionDTO> getReceptionDetail(@PathVariable Long id) {
        Optional<Reception> receptionOpt = receptionService.findById(id);
        if (receptionOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Reception reception = receptionOpt.get();
        ReceptionDTO dto = new ReceptionDTO();
        dto.setId(reception.getId());
        dto.setReference(reception.getReference());
        dto.setDateReception(reception.getDateReception().toString());
        dto.setIdCommandeFournisseur(reception.getCommandeFournisseur().getId());
        dto.setReferenceCommande(reception.getCommandeFournisseur().getReference());
        dto.setFournisseur(reception.getCommandeFournisseur().getFournisseur().getNom() + " " + reception.getCommandeFournisseur().getFournisseur().getPrenom());
        dto.setIdBoutique(reception.getBoutique().getId());

        // Get lignesCommande
        List<LigneCommande> lignesCommande = ligneCommandeRepository.findByCommandeFournisseurId(reception.getCommandeFournisseur().getId());
        // Get lignesReception
        List<LigneReception> lignesReception = ligneReceptionService.findByReceptionId(reception.getId());

        List<ReceptionDTO.LigneReceptionDTO> lignesDTO = new ArrayList<>();
        for (LigneCommande lc : lignesCommande) {
            ReceptionDTO.LigneReceptionDTO ligneDTO = new ReceptionDTO.LigneReceptionDTO();
            ligneDTO.setIdProduit(lc.getStock().getProduit().getId());
            ligneDTO.setDesignation(lc.getStock().getProduit().getNomProduit());
            ligneDTO.setDepot(""); // Assuming no depot
            ligneDTO.setStock(0); // Assuming no stock
            ligneDTO.setQteCommande(lc.getQuantite());
            // Find qteRecue
            Integer qteRecue = lignesReception.stream()
                .filter(lr -> lr.getProduit().getId().equals(lc.getStock().getProduit().getId()))
                .mapToInt(LigneReception::getQuantiteRecu)
                .sum();
            ligneDTO.setQteRecue(qteRecue);
            ligneDTO.setReceptionActuelle(lc.getQuantite() - qteRecue);
            lignesDTO.add(ligneDTO);
        }
        dto.setLignesReception(lignesDTO);
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/commande/{commandeId}/articles")
    public ResponseEntity<List<ReceptionDTO.LigneReceptionDTO>> getArticlesForCommande(@PathVariable Long commandeId) {
        try {
            Optional<CommandeFournisseur> commandeOpt = commandeFournisseurService.findById(commandeId);
            if (!commandeOpt.isPresent()) {
                return ResponseEntity.notFound().build();
            }

            CommandeFournisseur commande = commandeOpt.get();
            List<ReceptionDTO.LigneReceptionDTO> articles = new ArrayList<>();

            for (LigneCommande ligne : commande.getLignes()) {
                Integer qteLivre = ligne.getQuantiteLivre() != null ? ligne.getQuantiteLivre() : 0;
                
                // Ne retourner que les articles qui ne sont pas complètement reçus
                if (ligne.getQuantite() > qteLivre) {
                    ReceptionDTO.LigneReceptionDTO dto = new ReceptionDTO.LigneReceptionDTO();
                    dto.setIdProduit(ligne.getStock().getProduit().getId());
                    dto.setDesignation(ligne.getStock().getProduit().getNomProduit());
                    dto.setDepot(ligne.getStock().getMagasin().getNom());
                    dto.setStock(ligne.getStock().getQuantiteDisponible());
                    dto.setQteCommande(ligne.getQuantite());
                    dto.setQteRecue(qteLivre);
                    // Quantité restante à recevoir = quantité commandée - quantité déjà reçue
                    dto.setReceptionActuelle(ligne.getQuantite() - qteLivre);
                    articles.add(dto);
                }
            }

            return ResponseEntity.ok(articles);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/create")
    public ResponseEntity<ReceptionDTO> createReception(@RequestBody ReceptionDTO receptionDTO) {
        try {
            // Récupérer la commande fournisseur
            Optional<CommandeFournisseur> commandeOpt = commandeFournisseurService.findById(receptionDTO.getIdCommandeFournisseur());
            if (!commandeOpt.isPresent()) {
                return ResponseEntity.badRequest().build();
            }

            CommandeFournisseur commande = commandeOpt.get();

            // Récupérer la boutique depuis le DTO
            Optional<Boutique> boutiqueOpt = boutiqueService.findById(receptionDTO.getIdBoutique());
            if (!boutiqueOpt.isPresent()) {
                return ResponseEntity.badRequest().build();
            }

            Boutique boutique = boutiqueOpt.get();

            // Créer la réception
            Reception reception = new Reception();
            reception.setReference(receptionDTO.getReference());
            reception.setDateReception(LocalDateTime.now());
            reception.setCommandeFournisseur(commande);
            reception.setBoutique(boutique);

            Reception savedReception = receptionService.save(reception);

            // Validation des quantités avant traitement
            for (ReceptionDTO.LigneReceptionDTO ligneDTO : receptionDTO.getLignesReception()) {
                if (ligneDTO.getReceptionActuelle() > 0) {
                    // Trouver la ligne de commande correspondante pour validation
                    List<LigneCommande> lignesCommande = ligneCommandeRepository.findByCommandeFournisseurId(commande.getId());
                    boolean ligneTrouvee = false;
                    
                    for (LigneCommande ligneCommande : lignesCommande) {
                        if (ligneCommande.getStock().getProduit().getId().equals(ligneDTO.getIdProduit())) {
                            Integer qteDejaRecue = ligneCommande.getQuantiteLivre() != null ? ligneCommande.getQuantiteLivre() : 0;
                            Integer qteRestante = ligneCommande.getQuantite() - qteDejaRecue;
                            
                            if (ligneDTO.getReceptionActuelle() > qteRestante) {
                                return ResponseEntity.badRequest().body(null); // Quantité trop élevée
                            }
                            ligneTrouvee = true;
                            break;
                        }
                    }
                    
                    if (!ligneTrouvee) {
                        return ResponseEntity.badRequest().body(null); // Produit non trouvé dans la commande
                    }
                }
            }

            // Créer les lignes de réception et mettre à jour les stocks
            for (ReceptionDTO.LigneReceptionDTO ligneDTO : receptionDTO.getLignesReception()) {
                if (ligneDTO.getReceptionActuelle() > 0) {
                    LigneReception ligneReception = new LigneReception();
                    ligneReception.setReception(savedReception);
                    ligneReception.setQuantiteRecu(ligneDTO.getReceptionActuelle());

                    // Trouver le produit par ID
                    Optional<Produit> produitOpt = produitService.findById(ligneDTO.getIdProduit());
                    if (produitOpt.isPresent()) {
                        ligneReception.setProduit(produitOpt.get());

                        // Mettre à jour la quantité livrée dans la ligne de commande
                        List<LigneCommande> lignesCommande = ligneCommandeRepository.findByCommandeFournisseurId(commande.getId());
                        for (LigneCommande ligneCommande : lignesCommande) {
                            if (ligneCommande.getStock().getProduit().getId().equals(ligneDTO.getIdProduit())) {
                                // Ajouter la quantité reçue à la quantité déjà livrée
                                Integer quantiteLivreActuelle = ligneCommande.getQuantiteLivre() != null ? ligneCommande.getQuantiteLivre() : 0;
                                ligneCommande.setQuantiteLivre(quantiteLivreActuelle + ligneDTO.getReceptionActuelle());
                                ligneCommandeRepository.save(ligneCommande);
                                // Update stock using stock attached to the LigneCommande
                                if (ligneCommande.getStock() != null && ligneDTO.getReceptionActuelle() != null && ligneDTO.getReceptionActuelle() > 0) {
                                    Stock stock = ligneCommande.getStock();
                                    Integer currentQty = stock.getQuantiteDisponible() != null ? stock.getQuantiteDisponible() : 0;
                                    stock.setQuantiteDisponible(currentQty + ligneDTO.getReceptionActuelle());
                                    stockService.saveStock(stock);
                                }
                                break; // Sortir de la boucle une fois la ligne trouvée et mise à jour
                            }
                        }
                    }

                    ligneReceptionService.save(ligneReception);
                }
            }

            // Mettre à jour la commande (marquer comme partiellement reçue)
            // Ici on pourrait calculer le pourcentage total reçu, mais pour l'instant on retourne juste le DTO

            receptionDTO.setId(savedReception.getId());
            receptionDTO.setDateReception(LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")));

            return ResponseEntity.ok(receptionDTO);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
