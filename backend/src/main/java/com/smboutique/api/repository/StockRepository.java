package com.smboutique.api.repository;

import com.smboutique.api.model.Stock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StockRepository extends JpaRepository<Stock, Long> {

    List<Stock> findByProduitId(Long produitId);

    List<Stock> findByMagasinId(Long magasinId);

    Optional<Stock> findByProduitIdAndMagasinId(Long produitId, Long magasinId);

    @Query("SELECT s FROM Stock s LEFT JOIN FETCH s.produit LEFT JOIN FETCH s.magasin WHERE (:produitId IS NULL OR s.produit.id = :produitId) AND s.boutique.id = :boutiqueId")
    List<Stock> findByProduitIdAndBoutiqueId(@Param("produitId") Long produitId, @Param("boutiqueId") Long boutiqueId);
}