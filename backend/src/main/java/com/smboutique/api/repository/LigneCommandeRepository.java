package com.smboutique.api.repository;

import com.smboutique.api.model.LigneCommande;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LigneCommandeRepository extends JpaRepository<LigneCommande, Long> {
    
    @Query("SELECT lc FROM LigneCommande lc WHERE lc.commandeFournisseur.id = :commandeId")
    List<LigneCommande> findByCommandeFournisseurId(@Param("commandeId") Long commandeId);
}
