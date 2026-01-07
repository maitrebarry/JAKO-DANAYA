package com.smboutique.api.service.impl;

import com.smboutique.api.model.Inventaire;
import com.smboutique.api.repository.InventaireRepository;
import com.smboutique.api.service.InventaireService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class InventaireServiceImpl implements InventaireService {

    @Autowired
    private InventaireRepository inventaireRepository;

    @Autowired
    private com.smboutique.api.repository.LigneInventaireRepository ligneInventaireRepository;

    @Autowired
    private com.smboutique.api.repository.StockRepository stockRepository;

    @Autowired
    private com.smboutique.api.service.MouvementService mouvementService;

    @Autowired
    private com.smboutique.api.repository.ProduitRepository produitRepository;

    @Override
    public List<Inventaire> findAll() {
        return inventaireRepository.findAll();
    }

    @Override
    public Optional<Inventaire> findById(Long id) {
        return inventaireRepository.findById(id);
    }

    @Override
    public Inventaire save(Inventaire inventaire) {
        return inventaireRepository.save(inventaire);
    }

    @Override
    public void deleteById(Long id) {
        inventaireRepository.deleteById(id);
    }

    @Override
    public List<Inventaire> findByBoutiqueId(Long boutiqueId) {
        return inventaireRepository.findByBoutiqueId(boutiqueId);
    }

    @Override
    public boolean existsActiveInventoryForBoutique(Long boutiqueId) {
        return inventaireRepository.existsByBoutiqueIdAndRegulariserFalse(boutiqueId);
    }

    @Override
    public com.smboutique.api.model.LigneInventaire saveLigne(com.smboutique.api.model.LigneInventaire ligne) {
        // Compute ecartStock and montant at creation/update time if quantitePhysique is available and inventaire/boutique present
        try {
            if (ligne != null && ligne.getQuantitePhysique() != null) {
                com.smboutique.api.model.Inventaire inv = ligne.getInventaire();
                Long produitId = ligne.getProduit() != null ? ligne.getProduit().getId() : null;
                int stockTheorique = 0;
                if (produitId != null) {
                    com.smboutique.api.model.Stock stock = null;
                    if (inv != null && inv.getBoutique() != null && inv.getBoutique().getId() != null) {
                        java.util.List<com.smboutique.api.model.Stock> stocks = stockRepository.findByProduitIdAndBoutiqueId(produitId, inv.getBoutique().getId());
                        if (stocks != null && !stocks.isEmpty()) stock = stocks.get(0);
                    }
                    if (stock == null) {
                        java.util.List<com.smboutique.api.model.Stock> all = stockRepository.findByProduitId(produitId);
                        if (all != null && !all.isEmpty()) stock = all.get(0);
                    }
                    if (stock != null && stock.getQuantiteDisponible() != null) stockTheorique = stock.getQuantiteDisponible();
                }
                int quantitePhysique = ligne.getQuantitePhysique() == null ? 0 : ligne.getQuantitePhysique();
                int ecart = quantitePhysique - stockTheorique;
                ligne.setEcartStock(ecart);
                Integer prixAchat = ligne.getProduit() != null && ligne.getProduit().getPrixAchat() != null ? ligne.getProduit().getPrixAchat() : 0;
                ligne.setMontant(ecart * prixAchat);
            }
        } catch (Exception ex) {
            // ignore computation errors and proceed to save the ligne
        }
        return ligneInventaireRepository.save(ligne);
    }

    @Override
    public Optional<com.smboutique.api.model.LigneInventaire> findLigneById(Long id) {
        return ligneInventaireRepository.findById(id);
    }

    @Override
    public void deleteLigne(Long id) {
        ligneInventaireRepository.deleteById(id);
    }

    @Override
    public String getNextReference() {
        // compute next id by taking max id and adding 1
        Long maxId = inventaireRepository.findTopByOrderByIdDesc().map(Inventaire::getId).orElse(0L);
        Long next = maxId + 1;
        return String.format("R-IV-N°%06d", next);
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public RegularisationResult regularizeInventory(Long inventaireId, com.smboutique.api.model.Utilisateur user) {
        RegularisationResult result = new RegularisationResult();
        Inventaire inv = inventaireRepository.findById(inventaireId).orElseThrow(() -> new RuntimeException("Inventaire introuvable"));
        if (inv.getRegulariser() != null && inv.getRegulariser()) {
            throw new RuntimeException("Inventaire déjà regularisé");
        }
        java.util.List<com.smboutique.api.model.LigneInventaire> lignes = ligneInventaireRepository.findByInventaireId(inventaireId);

        for (com.smboutique.api.model.LigneInventaire li : lignes) {
            Long produitId = li.getProduit() != null ? li.getProduit().getId() : null;
            if (produitId == null) continue;

            // Try to find stock for this boutique and produit
            Long boutiqueId = inv.getBoutique() != null ? inv.getBoutique().getId() : null;
            com.smboutique.api.model.Stock stock = null;
            if (boutiqueId != null) {
                java.util.List<com.smboutique.api.model.Stock> stocks = stockRepository.findByProduitIdAndBoutiqueId(produitId, boutiqueId);
                if (stocks != null && !stocks.isEmpty()) stock = stocks.get(0);
            }
            if (stock == null) {
                // fallback: find any stock for product
                java.util.List<com.smboutique.api.model.Stock> all = stockRepository.findByProduitId(produitId);
                if (all != null && !all.isEmpty()) stock = all.get(0);
            }
            // If still null, create a new stock entry tied to boutique if possible
            if (stock == null) {
                stock = new com.smboutique.api.model.Stock();
                stock.setProduit(li.getProduit());
                if (inv.getBoutique() != null) stock.setBoutique(inv.getBoutique());
                stock.setQuantiteDisponible(0);
            }

            int stockTheorique = stock.getQuantiteDisponible() == null ? 0 : stock.getQuantiteDisponible();
            int quantitePhysique = li.getQuantitePhysique() == null ? 0 : li.getQuantitePhysique();
            int ecart = quantitePhysique - stockTheorique;
            li.setEcartStock(ecart);
            Integer prixAchat = li.getProduit() != null && li.getProduit().getPrixAchat() != null ? li.getProduit().getPrixAchat() : 0;
            li.setMontant(ecart * prixAchat);
            ligneInventaireRepository.save(li);

            if (ecart != 0) {
                // Create mouvement
                com.smboutique.api.model.Mouvement m = new com.smboutique.api.model.Mouvement();
                m.setProduit(li.getProduit());
                m.setBoutique(inv.getBoutique());
                m.setQuantite(ecart);
                m.setDateMouvement(java.time.LocalDateTime.now());
                m.setUtilisateur(user);
                m.setInventaire(inv);
                m.setReferenceInventaire(inv.getReference());

                // Use produit.prixAchat for valorisation; reuse variable declared above
                int montant = ecart * prixAchat;
                m.setMontant(montant);
                m.setTypeMouvement(ecart > 0 ? "AJUSTEMENT_ENTREE" : "AJUSTEMENT_SORTIE");

                com.smboutique.api.model.Mouvement saved = mouvementService.save(m);
                result.mouvementsCreated.add(saved.getId());

                // update stock
                int newQty = stockTheorique + ecart;
                stock.setQuantiteDisponible(newQty);
                stockRepository.save(stock);

                // accumulate totals
                result.totalValeurPhysique += quantitePhysique * prixAchat;
                result.totalValeurTheorique += stockTheorique * prixAchat;
                result.totalValeurEcart += ecart * prixAchat;
            } else {
                // still account for totals
                result.totalValeurPhysique += quantitePhysique * prixAchat;
                result.totalValeurTheorique += stockTheorique * prixAchat;
            }
        }

        // mark as regularized
        inv.setRegulariser(Boolean.TRUE);
        inventaireRepository.save(inv);
        return result;
    }
}
