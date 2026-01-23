package com.smboutique.api.repository;

import com.smboutique.api.model.LigneInventaire;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LigneInventaireRepository extends JpaRepository<LigneInventaire, Long> {
    java.util.List<LigneInventaire> findByInventaireId(Long inventaireId);
    java.util.Optional<LigneInventaire> findByInventaireIdAndProduitId(Long inventaireId, Long produitId);

    // Return lignes for which there exists a boutique-level stock (id_magasin IS NULL)
    @org.springframework.data.jpa.repository.Query("SELECT li FROM LigneInventaire li WHERE li.inventaire.id = :invId AND EXISTS (SELECT s FROM Stock s WHERE s.produit.id = li.produit.id AND s.boutique.id = :boutiqueId AND s.magasin IS NULL)")
    java.util.List<LigneInventaire> findBoutiqueScopedLines(@org.springframework.data.repository.query.Param("invId") Long inventaireId, @org.springframework.data.repository.query.Param("boutiqueId") Long boutiqueId);

    // Return lignes for which there exists a magasin-level stock (id_magasin IS NOT NULL)
    @org.springframework.data.jpa.repository.Query("SELECT li FROM LigneInventaire li WHERE li.inventaire.id = :invId AND EXISTS (SELECT s FROM Stock s WHERE s.produit.id = li.produit.id AND s.boutique.id = :boutiqueId AND s.magasin IS NOT NULL)")
    java.util.List<LigneInventaire> findMagasinScopedLines(@org.springframework.data.repository.query.Param("invId") Long inventaireId, @org.springframework.data.repository.query.Param("boutiqueId") Long boutiqueId);
}
