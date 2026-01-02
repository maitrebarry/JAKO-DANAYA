package com.smboutique.api.service.impl;

import com.smboutique.api.model.Mouvement;
import com.smboutique.api.model.Stock;
import com.smboutique.api.repository.StockRepository;
import com.smboutique.api.service.MouvementService;
import com.smboutique.api.service.TransferService;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Objects;

@Service
public class TransferServiceImpl implements TransferService {

    @Autowired
    private StockRepository stockRepository;

    @Autowired
    private MouvementService mouvementService;

    @Override
    @Transactional
    public void transfer(Long sourceStockId, Long destStockId, Integer quantite) {
        if (quantite == null || quantite <= 0) {
            throw new IllegalArgumentException("Quantité de transfert invalide");
        }
        if (Objects.equals(sourceStockId, destStockId)) {
            throw new IllegalArgumentException("Source et destination doivent être différentes");
        }

        Stock src = stockRepository.findById(sourceStockId).orElseThrow(() -> new RuntimeException("Stock source introuvable"));
        Stock dst = stockRepository.findById(destStockId).orElseThrow(() -> new RuntimeException("Stock destination introuvable"));

        // Source must be a magasin stock
        if (src.getMagasin() == null) {
            throw new IllegalArgumentException("Le stock source doit appartenir à un magasin");
        }

        // Allowed types: magasin -> magasin or magasin -> boutique (dst.magasin == null)
        // Check availability
        if (src.getQuantiteDisponible() == null || quantite > src.getQuantiteDisponible()) {
            throw new IllegalArgumentException("Quantité supérieure au stock disponible");
        }

        // perform quantity updates
        src.setQuantiteDisponible(src.getQuantiteDisponible() - quantite);
        Integer dstQty = dst.getQuantiteDisponible() == null ? 0 : dst.getQuantiteDisponible();
        dst.setQuantiteDisponible(dstQty + quantite);

        stockRepository.save(src);
        stockRepository.save(dst);

        // create SORTIE movement on source
        Mouvement sortie = new Mouvement();
        sortie.setStock(src);
        sortie.setProduit(src.getProduit());
        sortie.setQuantite(quantite);
        sortie.setTypeMouvement("SORTIE");
        sortie.setDateMouvement(LocalDateTime.now());
        // set boutique to source magasin's boutique
        if (src.getMagasin() != null) sortie.setBoutique(src.getMagasin().getBoutique());
        mouvementService.save(sortie);

        // create ENTREE movement on destination
        Mouvement entree = new Mouvement();
        entree.setStock(dst);
        entree.setProduit(dst.getProduit());
        entree.setQuantite(quantite);
        entree.setTypeMouvement("ENTREE");
        entree.setDateMouvement(LocalDateTime.now());
        // set boutique to destination boutique if available else source boutique
        if (dst.getMagasin() != null) entree.setBoutique(dst.getMagasin().getBoutique());
        else if (src.getMagasin() != null) entree.setBoutique(src.getMagasin().getBoutique());
        mouvementService.save(entree);

        // Note: higher-level transfers will also create a TRANSFERT mouvement linked to a Transfer record

    }
}
