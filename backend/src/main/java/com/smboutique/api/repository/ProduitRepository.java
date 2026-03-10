package com.smboutique.api.repository;

import com.smboutique.api.model.Produit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProduitRepository extends JpaRepository<Produit, Long> {

    @Query("SELECT DISTINCT p FROM Produit p JOIN p.stocks s WHERE s.boutique.id = :boutiqueId")
    List<Produit> findByBoutiqueId(@Param("boutiqueId") Long boutiqueId);

    @Query("SELECT DISTINCT p FROM Produit p LEFT JOIN FETCH p.stocks s WHERE p.id IN (SELECT p2.id FROM Produit p2 JOIN p2.stocks s2 WHERE s2.boutique.id = :boutiqueId)")
    List<Produit> findByBoutiqueIdWithStocks(@Param("boutiqueId") Long boutiqueId);
}
