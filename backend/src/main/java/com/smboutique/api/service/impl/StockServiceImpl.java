package com.smboutique.api.service.impl;

import com.smboutique.api.model.Stock;
import com.smboutique.api.repository.StockRepository;
import com.smboutique.api.service.StockService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class StockServiceImpl implements StockService {

    @Autowired
    private StockRepository stockRepository;

    @Override
    public List<Stock> getAllStocks() {
        return stockRepository.findAll();
    }

    @Override
    public Optional<Stock> getStockById(Long id) {
        return stockRepository.findById(id);
    }

    @Override
    public Stock saveStock(Stock stock) {
        if (stock.getBoutique() == null) {
            throw new IllegalArgumentException("Stock must be associated to a boutique");
        }
        // Safety guard: do not allow reassigning an existing boutique-level stock (magasin == null)
        // to a magasin by updating the same stock row. Enforce creation of a new magasin-level stock instead.
        if (stock.getId() != null) {
            java.util.Optional<Stock> existingOpt = stockRepository.findById(stock.getId());
            if (existingOpt.isPresent()) {
                Stock existing = existingOpt.get();
                if (existing.getMagasin() == null && stock.getMagasin() != null) {
                    throw new IllegalArgumentException("Reassigning a boutique-level stock to a magasin is forbidden. Create a new magazin-level stock instead.");
                }
            }
        }
        return stockRepository.save(stock);
    }

    @Override
    public void deleteStock(Long id) {
        stockRepository.deleteById(id);
    }

    @Override
    public List<Stock> getStocksByProduit(Long produitId) {
        return stockRepository.findByProduitId(produitId);
    }

    @Override
    public List<Stock> getStocksByMagasin(Long magasinId) {
        return stockRepository.findByMagasinId(magasinId);
    }

    @Override
    public Optional<Stock> getStockByProduitAndMagasin(Long produitId, Long magasinId) {
        return stockRepository.findByProduitIdAndMagasinId(produitId, magasinId);
    }

    @Override
    public List<Stock> getStocksByProduitAndBoutique(Long produitId, Long boutiqueId) {
        return stockRepository.findByProduitIdAndBoutiqueId(produitId, boutiqueId);
    }

    @Override
    public List<Stock> getBoutiqueLevelStocks(Long boutiqueId) {
        return stockRepository.findByBoutiqueIdAndMagasinIsNull(boutiqueId);
    }
}