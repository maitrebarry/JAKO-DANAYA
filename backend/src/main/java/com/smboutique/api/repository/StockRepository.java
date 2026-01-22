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

    @Query("SELECT s FROM Stock s LEFT JOIN FETCH s.produit LEFT JOIN FETCH s.magasin WHERE (:produitId IS NULL OR s.produit.id = :produitId) AND (s.boutique.id = :boutiqueId OR (s.magasin IS NOT NULL AND s.magasin.boutique.id = :boutiqueId))")
    List<Stock> findByProduitIdAndBoutiqueId(@Param("produitId") Long produitId, @Param("boutiqueId") Long boutiqueId);

    // ----- New: explicit scope-aware lookups (critical: rely on id_magasin presence) -----
    @Query("SELECT s FROM Stock s LEFT JOIN FETCH s.produit LEFT JOIN FETCH s.magasin WHERE s.produit.id = :produitId AND s.boutique.id = :boutiqueId AND s.magasin IS NULL")
    java.util.List<Stock> findByProduitIdAndBoutiqueIdAndMagasinIsNull(@Param("produitId") Long produitId, @Param("boutiqueId") Long boutiqueId);

    @Query("SELECT s FROM Stock s LEFT JOIN FETCH s.produit LEFT JOIN FETCH s.magasin WHERE s.produit.id = :produitId AND s.magasin IS NOT NULL AND (s.boutique.id = :boutiqueId OR s.magasin.boutique.id = :boutiqueId)")
    java.util.List<Stock> findByProduitIdAndBoutiqueIdAndMagasinIsNotNull(@Param("produitId") Long produitId, @Param("boutiqueId") Long boutiqueId);

    // convenience: return single stock matching scope (prefer first match)
    default java.util.Optional<Stock> findFirstByProduitIdAndBoutiqueIdAndMagasinIsNull(Long produitId, Long boutiqueId) {
        java.util.List<Stock> l = findByProduitIdAndBoutiqueIdAndMagasinIsNull(produitId, boutiqueId);
        return l == null || l.isEmpty() ? java.util.Optional.empty() : java.util.Optional.of(l.get(0));
    }

    default java.util.Optional<Stock> findFirstByProduitIdAndBoutiqueIdAndMagasinIsNotNull(Long produitId, Long boutiqueId) {
        java.util.List<Stock> l = findByProduitIdAndBoutiqueIdAndMagasinIsNotNull(produitId, boutiqueId);
        return l == null || l.isEmpty() ? java.util.Optional.empty() : java.util.Optional.of(l.get(0));
    }

    // Return all boutique-level stocks for a boutique (magasin IS NULL)
    @Query("SELECT s FROM Stock s LEFT JOIN FETCH s.produit LEFT JOIN FETCH s.magasin WHERE s.boutique.id = :boutiqueId AND s.magasin IS NULL")
    java.util.List<Stock> findByBoutiqueIdAndMagasinIsNull(@Param("boutiqueId") Long boutiqueId);
}