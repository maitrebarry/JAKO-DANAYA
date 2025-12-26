package com.smboutique.api.repository;

import com.smboutique.api.model.CommandeFournisseur;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CommandeFournisseurRepository extends JpaRepository<CommandeFournisseur, Long> {
    List<CommandeFournisseur> findAllByBoutiqueId(Long boutiqueId);
    Optional<CommandeFournisseur> findByIdAndBoutiqueId(Long id, Long boutiqueId);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT cf FROM CommandeFournisseur cf JOIN cf.lignes lc WHERE lc.quantite > COALESCE(lc.quantiteLivre, 0)")
    List<CommandeFournisseur> findNonReceptionnees();

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT cf FROM CommandeFournisseur cf JOIN cf.lignes lc WHERE lc.quantite > COALESCE(lc.quantiteLivre, 0) AND cf.boutique.id = :boutiqueId")
    java.util.List<CommandeFournisseur> findNonReceptionneesByBoutiqueId(@org.springframework.data.repository.query.Param("boutiqueId") Long boutiqueId);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT cf FROM CommandeFournisseur cf WHERE cf.id NOT IN (SELECT lc.commandeFournisseur.id FROM LigneCommande lc WHERE lc.quantite > COALESCE(lc.quantiteLivre,0)) AND cf.boutique.id = :boutiqueId")
    java.util.List<CommandeFournisseur> findCommandesTotalementReceptionneesByBoutiqueId(@org.springframework.data.repository.query.Param("boutiqueId") Long boutiqueId);
}
