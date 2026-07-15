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
        // Deliberately boutique-scoped only: ventes/réceptions manipulate boutique-level stock,
        // and an active magasin inventaire never touches that stock, so it must not block them.
        return inventaireRepository.existsByBoutiqueIdAndMagasinIsNullAndRegulariserFalse(boutiqueId);
    }

    /**
     * Ensure there is no other active (non-regularized) inventaire with the exact same
     * scope — same boutique, and same magasin (both null, or the same magasin id).
     */
    public void checkActiveInventoryConflictOnAddingLine(com.smboutique.api.model.Inventaire inv, Long produitId) {
        if (inv == null) return;
        Long boutiqueId = inv.getBoutique() != null ? inv.getBoutique().getId() : null;
        if (boutiqueId == null) return;
        Long magasinId = inv.getMagasin() != null ? inv.getMagasin().getId() : null;

        boolean conflict = inventaireRepository.findByBoutiqueId(boutiqueId).stream()
                .anyMatch(a -> !a.getId().equals(inv.getId())
                        && Boolean.FALSE.equals(a.getRegulariser())
                        && java.util.Objects.equals(a.getMagasin() != null ? a.getMagasin().getId() : null, magasinId));
        if (conflict) {
            throw new RuntimeException(magasinId != null
                    ? "Un inventaire actif existe déjà pour ce magasin"
                    : "Un inventaire actif existe déjà pour cette boutique");
        }
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public com.smboutique.api.model.LigneInventaire saveLigne(com.smboutique.api.model.LigneInventaire ligne) {
        // Compute ecartStock and montant at creation/update time if quantitePhysique is available and inventaire/boutique present
        try {
            if (ligne != null && ligne.getQuantitePhysique() != null) {
                com.smboutique.api.model.Inventaire inv = ligne.getInventaire();
                Long produitId = ligne.getProduit() != null ? ligne.getProduit().getId() : null;

                // The inventaire's scope is explicit (its own magasin field) — no more inference
                // from existing lignes. Lock the inventaire to serialize concurrent addLigne calls.
                Long magasinIdForScope = null;
                if (produitId != null && inv != null && inv.getBoutique() != null && inv.getBoutique().getId() != null) {
                    com.smboutique.api.model.Inventaire lockedInv = inventaireRepository.findByIdForUpdate(inv.getId()).orElse(inv);
                    Long boutiqueId = lockedInv.getBoutique() != null ? lockedInv.getBoutique().getId() : null;
                    magasinIdForScope = lockedInv.getMagasin() != null ? lockedInv.getMagasin().getId() : null;

                    boolean produitInScope = magasinIdForScope != null
                            ? stockRepository.findByProduitIdAndMagasinId(produitId, magasinIdForScope).isPresent()
                            : !stockRepository.findByProduitIdAndBoutiqueIdAndMagasinIsNull(produitId, boutiqueId).isEmpty();
                    if (!produitInScope) {
                        throw new RuntimeException(magasinIdForScope != null
                                ? "Produit absent du stock de ce magasin"
                                : "Produit absent du stock de la boutique");
                    }
                }

                int stockTheorique = 0;
                if (produitId != null) {
                    com.smboutique.api.model.Stock stock = null;
                    Long magasinId = inv != null && inv.getMagasin() != null ? inv.getMagasin().getId() : magasinIdForScope;
                    if (magasinId != null) {
                        stock = stockRepository.findByProduitIdAndMagasinId(produitId, magasinId).orElse(null);
                    } else if (inv != null && inv.getBoutique() != null && inv.getBoutique().getId() != null) {
                        java.util.List<com.smboutique.api.model.Stock> l = stockRepository.findByProduitIdAndBoutiqueIdAndMagasinIsNull(produitId, inv.getBoutique().getId());
                        if (l != null && !l.isEmpty()) stock = l.get(0);
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
            // surface validation/runtime errors up so controller can report them — keep computation errors swallowed as before
            if (ex instanceof RuntimeException) throw (RuntimeException) ex;
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
        // Pessimistic lock: prevents two concurrent/duplicate requests (e.g. a double-click on the
        // "Régulariser" button) from both passing the "already regularized" check and applying the
        // stock adjustment twice, which would double-count écarts/montants.
        Inventaire inv = inventaireRepository.findByIdForUpdate(inventaireId).orElseThrow(() -> new RuntimeException("Inventaire introuvable"));
        if (inv.getRegulariser() != null && inv.getRegulariser()) {
            throw new RuntimeException("Inventaire déjà regularisé");
        }
        java.util.List<com.smboutique.api.model.LigneInventaire> lignes = ligneInventaireRepository.findByInventaireId(inventaireId);

        // Scope is explicit on the inventaire itself — no more inference needed. Every ligne
        // simply gets corrected against the stock row matching that exact scope.
        Long boutiqueId = inv.getBoutique() != null ? inv.getBoutique().getId() : null;
        Long magasinId = inv.getMagasin() != null ? inv.getMagasin().getId() : null;

        for (com.smboutique.api.model.LigneInventaire li : lignes) {
            Long produitId = li.getProduit() != null ? li.getProduit().getId() : null;
            if (produitId == null) continue;

            com.smboutique.api.model.Stock stock = null;
            if (magasinId != null) {
                stock = stockRepository.findByProduitIdAndMagasinId(produitId, magasinId).orElse(null);
            } else if (boutiqueId != null) {
                java.util.List<com.smboutique.api.model.Stock> stocks = stockRepository.findByProduitIdAndBoutiqueIdAndMagasinIsNull(produitId, boutiqueId);
                if (stocks != null && !stocks.isEmpty()) stock = stocks.get(0);
            }
            // If still null, create a new stock entry tied to the inventaire's own scope
            if (stock == null) {
                stock = new com.smboutique.api.model.Stock();
                stock.setProduit(li.getProduit());
                if (magasinId != null) {
                    stock.setMagasin(inv.getMagasin());
                    stock.setBoutique(inv.getBoutique());
                } else if (inv.getBoutique() != null) {
                    stock.setBoutique(inv.getBoutique());
                }
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
                m.setMagasin(inv.getMagasin());
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
