package com.smboutique.api.service.impl;

import com.smboutique.api.model.Mouvement;
import com.smboutique.api.model.Stock;
import com.smboutique.api.model.Transfer;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.StockRepository;
import com.smboutique.api.repository.TransferRepository;
import com.smboutique.api.service.MouvementService;
import com.smboutique.api.service.TransferModuleService;
import com.smboutique.api.service.UtilisateurService;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class TransferModuleServiceImpl implements TransferModuleService {

    @Autowired
    private StockRepository stockRepository;

    @Autowired
    private com.smboutique.api.service.StockService stockService;

    @Autowired
    private TransferRepository transferRepository;

    @Autowired
    private MouvementService mouvementService;

    @Autowired
    private UtilisateurService utilisateurService;

    @Override
    @Transactional
    public void transferBetweenLocations(String sourceType, Long sourceId, String destType, Long destId, List<TransferItem> items, String username) {
        if (sourceType == null || destType == null || items == null || items.isEmpty()) {
            throw new IllegalArgumentException("Paramètres de transfert invalides");
        }
        if (sourceType.equals(destType) && ((sourceId == null && destId == null) || (sourceId != null && sourceId.equals(destId)))) {
            throw new IllegalArgumentException("Source et destination doivent être différentes");
        }

        Utilisateur user = utilisateurService.findByEmail(username).orElse(null);

        Transfer tr = new Transfer();
        tr.setSourceType(sourceType);
        tr.setSourceId(sourceId);
        tr.setDestType(destType);
        tr.setDestId(destId);
        tr.setUtilisateur(user);
        tr.setDateTransfer(LocalDateTime.now());
        Transfer savedTr = transferRepository.save(tr);

        for (TransferItem it : items) {
            if (it.produitId == null || it.quantite == null || it.quantite <= 0) {
                throw new IllegalArgumentException("Quantité invalide pour produit " + it.produitId);
            }
            // find source stock
            Stock src = null;
            if ("MAGASIN".equalsIgnoreCase(sourceType)) {
                // sourceId is magasin id -> find stock by produit+magasin
                src = stockService.getStockByProduitAndMagasin(it.produitId, sourceId).orElse(null);
                if (src == null || src.getQuantiteDisponible() == null || it.quantite > src.getQuantiteDisponible()) {
                    throw new IllegalArgumentException("Stock source insuffisant pour produit " + it.produitId);
                }
            } else {
                // BOUTIQUE source: find boutique-level stock (magasin==null)
                List<Stock> bstocks = stockService.getStocksByProduitAndBoutique(it.produitId, sourceId);
                if (bstocks == null || bstocks.isEmpty()) throw new IllegalArgumentException("Stock boutique introuvable pour produit " + it.produitId);
                // find boutique-level
                src = bstocks.stream().filter(s -> s.getMagasin() == null).findFirst().orElse(null);
                if (src == null || src.getQuantiteDisponible() == null || it.quantite > src.getQuantiteDisponible()) {
                    throw new IllegalArgumentException("Stock source insuffisant pour produit " + it.produitId);
                }
            }

            // find destination stock
            Stock dest = null;
            if ("MAGASIN".equalsIgnoreCase(destType)) {
                // product must be assigned to this magasin
                dest = stockService.getStockByProduitAndMagasin(it.produitId, destId).orElse(null);
                if (dest == null) throw new IllegalArgumentException("Produit non assigné au magasin destination pour produit " + it.produitId);
            } else {
                // BOUTIQUE destination: find boutique-level stock or create
                List<Stock> bstocks = stockService.getStocksByProduitAndBoutique(it.produitId, destId);
                if (bstocks != null) {
                    for (Stock s : bstocks) { if (s.getMagasin() == null) { dest = s; break; } }
                }
                if (dest == null) {
                    // create boutique-level stock
                    Stock s = new Stock();
                    s.setProduit(src.getProduit());
                    s.setMagasin(null);
                    s.setBoutique(src.getBoutique());
                    s.setQuantiteDisponible(0);
                    dest = stockService.saveStock(s);
                }
            }

            // Lock stocks before applying read-modify-write updates (deterministic order)
            Long srcId = src != null ? src.getId() : null;
            Long destStockId = dest != null ? dest.getId() : null;
            if (srcId != null && destStockId != null && !srcId.equals(destStockId)) {
                if (srcId < destStockId) {
                    src = stockRepository.findByIdForUpdate(srcId).orElse(src);
                    dest = stockRepository.findByIdForUpdate(destStockId).orElse(dest);
                } else {
                    dest = stockRepository.findByIdForUpdate(destStockId).orElse(dest);
                    src = stockRepository.findByIdForUpdate(srcId).orElse(src);
                }
            } else {
                if (srcId != null) src = stockRepository.findByIdForUpdate(srcId).orElse(src);
                if (destStockId != null) dest = stockRepository.findByIdForUpdate(destStockId).orElse(dest);
            }

            if (src == null) throw new IllegalArgumentException("Stock source introuvable pour produit " + it.produitId);
            if (dest == null) throw new IllegalArgumentException("Stock destination introuvable pour produit " + it.produitId);
            if (src.getQuantiteDisponible() == null || it.quantite > src.getQuantiteDisponible()) {
                throw new IllegalArgumentException("Stock source insuffisant pour produit " + it.produitId);
            }

            // perform quantity changes
            int q = it.quantite;
            src.setQuantiteDisponible(src.getQuantiteDisponible() - q);
            Integer destQty = dest.getQuantiteDisponible() == null ? 0 : dest.getQuantiteDisponible();
            dest.setQuantiteDisponible(destQty + q);
            stockService.saveStock(src);
            stockService.saveStock(dest);

            // create a TRANSFERT movement linked to this transfer
            Mouvement mv = new Mouvement();
            mv.setProduit(src.getProduit());
            mv.setStock(src);
            mv.setQuantite(q);
            mv.setTypeMouvement("TRANSFERT");
            mv.setDateMouvement(LocalDateTime.now());
            mv.setTransfer(savedTr);
            // set boutique context to source boutique if available
            if (src.getBoutique() != null) mv.setBoutique(src.getBoutique());
            mouvementService.save(mv);
        }
    }
}
