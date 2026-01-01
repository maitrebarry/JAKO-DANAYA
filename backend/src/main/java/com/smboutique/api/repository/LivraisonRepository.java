package com.smboutique.api.repository;

import com.smboutique.api.model.Livraison;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

@Repository
public interface LivraisonRepository extends JpaRepository<Livraison, Long> {
    @Query("select l from Livraison l where l.commandeClient is not null and l.commandeClient.boutique is not null and l.commandeClient.boutique.id = :bid")
    List<Livraison> findByCommandeClientBoutiqueId(@Param("bid") Long boutiqueId);

    @Query("select l from Livraison l where l.commandeClient is not null and ((l.commandeClient.boutique is not null and l.commandeClient.boutique.id = :bid) or (l.commandeClient.utilisateur is not null and l.commandeClient.utilisateur.boutique is not null and l.commandeClient.utilisateur.boutique.id = :bid))")
    List<Livraison> findByCommandeClientBoutiqueIdOrCommandeClientUtilisateurBoutiqueId(@Param("bid") Long boutiqueId);
}
