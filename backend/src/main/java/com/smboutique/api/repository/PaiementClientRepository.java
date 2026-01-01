package com.smboutique.api.repository;

import com.smboutique.api.model.PaiementClient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

@Repository
public interface PaiementClientRepository extends JpaRepository<PaiementClient, Long> {
    @Query("select p from PaiementClient p where p.commandeClient is not null and p.commandeClient.boutique is not null and p.commandeClient.boutique.id = :bid")
    List<PaiementClient> findByCommandeClientBoutiqueId(@Param("bid") Long boutiqueId);

    @Query("select p from PaiementClient p where p.commandeClient is not null and p.commandeClient.id = :cid")
    List<PaiementClient> findByCommandeClientId(@Param("cid") Long commandeId);
}
