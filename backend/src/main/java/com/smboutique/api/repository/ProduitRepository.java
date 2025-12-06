package com.smboutique.api.repository;

import com.smboutique.api.model.Produit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProduitRepository extends JpaRepository<Produit, Long> {

    @Query("SELECT DISTINCT p FROM Produit p JOIN p.stocks s JOIN s.magasin m WHERE m.boutique.id = :boutiqueId")
    List<Produit> findByBoutiqueId(@Param("boutiqueId") Long boutiqueId);
}
