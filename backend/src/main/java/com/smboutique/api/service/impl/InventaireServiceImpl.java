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

    /**
     * Ensure there is no active inventory conflicting with a new ligne being added to inventaire 'inv'
     * This inspects existing active inventories' effective scopes (deduced from their lignes via stock rows)
     * and throws RuntimeException with message suitable for client when conflict detected.
     */
    public void checkActiveInventoryConflictOnAddingLine(com.smboutique.api.model.Inventaire inv, Long produitId) {
        if (inv == null || produitId == null) return;
        Long boutiqueId = inv.getBoutique() != null ? inv.getBoutique().getId() : null;
        if (boutiqueId == null) return;

        java.util.List<com.smboutique.api.model.Stock> stocks = stockRepository.findByProduitIdAndBoutiqueId(produitId, boutiqueId);
        boolean produitHasBoutiqueStock = stocks != null && stocks.stream().anyMatch(s -> s.getMagasin() == null);
        boolean produitHasMagasinStock = stocks != null && stocks.stream().anyMatch(s -> s.getMagasin() != null);
        java.util.Set<Long> produitMagasinIds = new java.util.HashSet<>();
        if (stocks != null) {
            for (com.smboutique.api.model.Stock s : stocks) {
                if (s.getMagasin() != null && s.getMagasin().getId() != null) produitMagasinIds.add(s.getMagasin().getId());
            }
        }

        java.util.List<com.smboutique.api.model.Inventaire> activeInvs = inventaireRepository.findByBoutiqueId(boutiqueId).stream()
                .filter(i -> Boolean.FALSE.equals(i.getRegulariser()) && !i.getId().equals(inv.getId()))
                .toList();

        for (com.smboutique.api.model.Inventaire a : activeInvs) {
            java.util.List<com.smboutique.api.model.LigneInventaire> lignes = ligneInventaireRepository.findByInventaireId(a.getId());
            boolean aHasBoutiqueLines = false;
            boolean aHasMagasinLines = false;
            java.util.Set<Long> aMagasinIds = new java.util.HashSet<>();

            for (com.smboutique.api.model.LigneInventaire li : lignes) {
                Long pid = li.getProduit() != null ? li.getProduit().getId() : null;
                if (pid == null) continue;
                java.util.List<com.smboutique.api.model.Stock> st = stockRepository.findByProduitIdAndBoutiqueId(pid, boutiqueId);
                if (st != null && st.stream().anyMatch(s -> s.getMagasin() == null)) aHasBoutiqueLines = true;
                if (st != null) {
                    for (com.smboutique.api.model.Stock s : st) {
                        if (s.getMagasin() != null && s.getMagasin().getId() != null) {
                            aHasMagasinLines = true;
                            aMagasinIds.add(s.getMagasin().getId());
                        }
                    }
                }
            }

            // Mixed scoped active inventaire -> conservative conflict
            if (aHasBoutiqueLines && aHasMagasinLines) {
                throw new RuntimeException("Une inventaire actif existe déjà pour cette boutique");
            }

            // active boutique-only inventory vs produit boutique-only
            if (aHasBoutiqueLines && produitHasBoutiqueStock && !produitHasMagasinStock) {
                throw new RuntimeException("Une inventaire actif existe déjà pour cette boutique");
            }

            // active magasin-only inventory vs produit magasin-only: conflict if any magasin id overlaps
            if (aHasMagasinLines && produitHasMagasinStock) {
                for (Long mid : produitMagasinIds) {
                    if (aMagasinIds.contains(mid)) {
                        throw new RuntimeException("Une inventaire actif existe déjà pour ce magasin");
                    }
                }
            }
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

                // Determine produit scope (boutique vs magasin) and infer inventaire scope from existing lignes
                if (produitId != null && inv != null && inv.getBoutique() != null && inv.getBoutique().getId() != null) {
                    // Acquire pessimistic lock on inventaire to avoid concurrent mixed-scope inserts
                    com.smboutique.api.model.Inventaire lockedInv = inventaireRepository.findByIdForUpdate(inv.getId()).orElse(inv);
                    Long boutiqueId = lockedInv.getBoutique() != null ? lockedInv.getBoutique().getId() : null;

                    // Inspect ALL stocks for the produit to detect boutique- vs magasin-level entries
                    java.util.List<com.smboutique.api.model.Stock> allStocksForProduit = stockRepository.findByProduitId(produitId);
                    boolean produitHasBoutiqueStock = allStocksForProduit != null && allStocksForProduit.stream().anyMatch(s -> s.getMagasin() == null && (s.getBoutique() == null || s.getBoutique().getId().equals(boutiqueId)));
                    boolean produitHasMagasinStock = allStocksForProduit != null && allStocksForProduit.stream().anyMatch(s -> s.getMagasin() != null && s.getMagasin().getBoutique() != null && s.getMagasin().getBoutique().getId().equals(boutiqueId));

                    // Recompute existing lignes under lock to infer inventaire scope
                    boolean invHasBoutiqueLines = false;
                    boolean invHasMagasinLines = false;
                    java.util.List<com.smboutique.api.model.LigneInventaire> existing = ligneInventaireRepository.findByInventaireId(lockedInv.getId());
                    for (com.smboutique.api.model.LigneInventaire li : existing) {
                        Long pid = li.getProduit() != null ? li.getProduit().getId() : null;
                        if (pid == null) continue;
                        java.util.List<com.smboutique.api.model.Stock> stAll = stockRepository.findByProduitId(pid);
                        if (stAll != null && stAll.stream().anyMatch(s -> s.getMagasin() == null && (s.getBoutique() == null || s.getBoutique().getId().equals(boutiqueId)))) invHasBoutiqueLines = true;
                        if (stAll != null && stAll.stream().anyMatch(s -> s.getMagasin() != null && s.getMagasin().getBoutique() != null && s.getMagasin().getBoutique().getId().equals(boutiqueId))) invHasMagasinLines = true;
                    }
                    if (invHasBoutiqueLines && invHasMagasinLines) {
                        throw new RuntimeException("Inventaire contient déjà des lignes de portées différentes");
                    }

                    // ENFORCEMENT: inventory is boutique-only. Reject produit that exists ONLY at magasin level.
                    if (produitHasMagasinStock && !produitHasBoutiqueStock) {
                        throw new RuntimeException("Produit présent uniquement en magasin — impossible d'ajouter/mettre à jour pour un inventaire boutique");
                    }

                    // From now on prefer boutique-level stock when resolving theoretical stock for inventaire computations
                    // (if absent, we may fallback to any available stock for historical/read purposes).
                }

                int stockTheorique = 0;
                if (produitId != null) {
                    com.smboutique.api.model.Stock stock = null;

                    // Prefer a stock entry that matches the inferred inventaire scope:
                    // - if inventaire contains magasin-lines, prefer stock.magasin != null
                    // - otherwise prefer stock.magasin == null (boutique-level)
                    if (ligne.getInventaire() != null && ligne.getInventaire().getBoutique() != null && ligne.getInventaire().getBoutique().getId() != null) {
                        Long boutiqueId = ligne.getInventaire().getBoutique().getId();
                        java.util.List<com.smboutique.api.model.Stock> stocks = stockRepository.findByProduitIdAndBoutiqueId(produitId, boutiqueId);
                        if (stocks != null && !stocks.isEmpty()) {
                            // NEW POLICY: prefer boutique-level stock for inventory computations
                            java.util.Optional<com.smboutique.api.model.Stock> optBout = stocks.stream().filter(s -> s.getMagasin() == null).findFirst();
                            if (optBout.isPresent()) {
                                stock = optBout.get();
                            } else {
                                // fallback to any magasin-level stock (for historical cases only)
                                stock = stocks.get(0);
                            }
                        }
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
        Inventaire inv = inventaireRepository.findById(inventaireId).orElseThrow(() -> new RuntimeException("Inventaire introuvable"));
        if (inv.getRegulariser() != null && inv.getRegulariser()) {
            throw new RuntimeException("Inventaire déjà regularisé");
        }
        java.util.List<com.smboutique.api.model.LigneInventaire> lignes = ligneInventaireRepository.findByInventaireId(inventaireId);

        // Pre-check: ensure inventaire is not mixing boutique and magasin lignes.
        java.util.List<Long> outOfScope = new java.util.ArrayList<>();
        boolean invHasBoutiqueLines = false;
        boolean invHasMagasinLines = false;
        Long boutiqueId = inv.getBoutique() != null ? inv.getBoutique().getId() : null;

        for (com.smboutique.api.model.LigneInventaire li : lignes) {
            Long produitId = li.getProduit() != null ? li.getProduit().getId() : null;
            if (produitId == null) continue;

            java.util.List<com.smboutique.api.model.Stock> stAll = stockRepository.findByProduitId(produitId);
            boolean produitHasBoutiqueStock = stAll != null && stAll.stream().anyMatch(s -> s.getMagasin() == null && (s.getBoutique() == null || boutiqueId == null || s.getBoutique().getId().equals(boutiqueId)));
            boolean produitHasMagasinStock = stAll != null && stAll.stream().anyMatch(s -> s.getMagasin() != null && s.getMagasin().getBoutique() != null && (boutiqueId == null || s.getMagasin().getBoutique().getId().equals(boutiqueId)));

            if (produitHasBoutiqueStock) invHasBoutiqueLines = true;
            if (produitHasMagasinStock) invHasMagasinLines = true;

            if (!produitHasBoutiqueStock && produitHasMagasinStock) {
                // produit appears to be magasin-only for this boutique
                outOfScope.add(li.getId());
            }
        }

        // If both kinds are present -> mixed inventaire (invalid)
        if (invHasBoutiqueLines && invHasMagasinLines) {
            throw new RuntimeException("Inventaire contient des lignes de portées différentes");
        }

        if (!outOfScope.isEmpty() && invHasBoutiqueLines) {
            throw new RuntimeException("Inventaire contient des lignes hors-scope (ids): " + outOfScope.toString());
        }

        for (com.smboutique.api.model.LigneInventaire li : lignes) {
            Long produitId = li.getProduit() != null ? li.getProduit().getId() : null;
            if (produitId == null) continue;

            // Try to find stock for this boutique and produit — prefer magasin-level stock when inventaire is magasin-scoped
            com.smboutique.api.model.Stock stock = null;
            boolean inventaireAppearsMagasinScoped = false;
            if (!lignes.isEmpty()) {
                inventaireAppearsMagasinScoped = lignes.stream().anyMatch(x -> {
                    java.util.List<com.smboutique.api.model.Stock> st = stockRepository.findByProduitIdAndBoutiqueId(x.getProduit().getId(), boutiqueId);
                    return st != null && st.stream().anyMatch(s -> s.getMagasin() != null);
                }) && lignes.stream().noneMatch(x -> {
                    java.util.List<com.smboutique.api.model.Stock> st = stockRepository.findByProduitIdAndBoutiqueId(x.getProduit().getId(), boutiqueId);
                    return st != null && st.stream().anyMatch(s -> s.getMagasin() == null);
                });
            }

            if (boutiqueId != null) {
                java.util.List<com.smboutique.api.model.Stock> stocks = stockRepository.findByProduitIdAndBoutiqueId(produitId, boutiqueId);
                if (stocks != null && !stocks.isEmpty()) {
                    if (inventaireAppearsMagasinScoped) {
                        java.util.Optional<com.smboutique.api.model.Stock> opt = stocks.stream().filter(s -> s.getMagasin() != null).findFirst();
                        if (opt.isPresent()) stock = opt.get();
                    }
                    if (stock == null) {
                        java.util.Optional<com.smboutique.api.model.Stock> opt2 = stocks.stream().filter(s -> s.getMagasin() == null).findFirst();
                        if (opt2.isPresent()) stock = opt2.get();
                    }
                }
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
