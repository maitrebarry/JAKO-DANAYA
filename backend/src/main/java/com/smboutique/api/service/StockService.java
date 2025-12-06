package com.smboutique.api.service;

import com.smboutique.api.model.Stock;

import java.util.List;
import java.util.Optional;

public interface StockService {

    List<Stock> getAllStocks();

    Optional<Stock> getStockById(Long id);

    Stock saveStock(Stock stock);

    void deleteStock(Long id);

    List<Stock> getStocksByProduit(Long produitId);

    List<Stock> getStocksByMagasin(Long magasinId);

    Optional<Stock> getStockByProduitAndMagasin(Long produitId, Long magasinId);

    List<Stock> getStocksByProduitAndBoutique(Long produitId, Long boutiqueId);
}