package com.smboutique.api.repository;

import com.smboutique.api.model.Paiement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PaiementRepository extends JpaRepository<Paiement, Long> {
    @org.springframework.data.jpa.repository.Query("SELECT p FROM Paiement p WHERE p.commandeFournisseur.boutique.id = :boutiqueId")
    java.util.List<com.smboutique.api.model.Paiement> findByBoutiqueId(@org.springframework.data.repository.query.Param("boutiqueId") Long boutiqueId);

    // Find payments for a given commande, ordered by date (ascending)
    @org.springframework.data.jpa.repository.Query("SELECT p FROM Paiement p WHERE p.commandeFournisseur.id = :commandeId ORDER BY p.datePaie ASC")
    java.util.List<com.smboutique.api.model.Paiement> findByCommandeFournisseurId(@org.springframework.data.repository.query.Param("commandeId") Long commandeId);
}
