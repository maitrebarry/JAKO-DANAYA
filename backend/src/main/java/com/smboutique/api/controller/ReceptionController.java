package com.smboutique.api.controller;

import com.smboutique.api.dto.ReceptionDTO;
import com.smboutique.api.model.Reception;
import com.smboutique.api.model.LigneCommande;
import com.smboutique.api.model.LigneReception;
import com.smboutique.api.model.Produit;
import com.smboutique.api.model.Stock;
import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.CommandeFournisseur;
import com.smboutique.api.service.BoutiqueService;
import com.smboutique.api.service.ReceptionService;
import com.smboutique.api.service.CommandeFournisseurService;
import com.smboutique.api.service.LigneReceptionService;
import com.smboutique.api.service.StockService;
import com.smboutique.api.service.ProduitService;
import com.smboutique.api.repository.LigneCommandeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.ArrayList;
import java.util.Optional;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
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

    @GetMapping
    public List<Reception> getAllReceptions() {
        return receptionService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Reception> getReceptionById(@PathVariable Long id) {
        return receptionService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Reception createReception(@RequestBody Reception reception) {
        return receptionService.save(reception);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Reception> updateReception(@PathVariable Long id, @RequestBody Reception receptionDetails) {
        return receptionService.findById(id)
                .map(reception -> {
                    reception.setReference(receptionDetails.getReference());
                    reception.setDateReception(receptionDetails.getDateReception());
                    reception.setCommandeFournisseur(receptionDetails.getCommandeFournisseur());
                    return ResponseEntity.ok(receptionService.save(reception));
                })
                .orElse(ResponseEntity.notFound().build());
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

                        // Mettre à jour le stock
                        Optional<Stock> stockOpt = stockService.getStockByProduitAndMagasin(
                            ligneDTO.getIdProduit(),
                            commande.getBoutique().getId() // Supposons que le stock est dans la boutique de la commande
                        );

                        if (stockOpt.isPresent()) {
                            Stock stock = stockOpt.get();
                            stock.setQuantiteDisponible(stock.getQuantiteDisponible() + ligneDTO.getReceptionActuelle());
                            stockService.saveStock(stock);
                        }

                        // Mettre à jour la quantité livrée dans la ligne de commande
                        List<LigneCommande> lignesCommande = ligneCommandeRepository.findByCommandeFournisseurId(commande.getId());
                        for (LigneCommande ligneCommande : lignesCommande) {
                            if (ligneCommande.getStock().getProduit().getId().equals(ligneDTO.getIdProduit())) {
                                // Ajouter la quantité reçue à la quantité déjà livrée
                                Integer quantiteLivreActuelle = ligneCommande.getQuantiteLivre() != null ? ligneCommande.getQuantiteLivre() : 0;
                                ligneCommande.setQuantiteLivre(quantiteLivreActuelle + ligneDTO.getReceptionActuelle());
                                ligneCommandeRepository.save(ligneCommande);
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
