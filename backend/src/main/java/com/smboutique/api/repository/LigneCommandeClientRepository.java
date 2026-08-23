package com.smboutique.api.repository;

import com.smboutique.api.model.LigneCommandeClient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LigneCommandeClientRepository extends JpaRepository<LigneCommandeClient, Long> {
    List<LigneCommandeClient> findByCommandeClientId(Long commandeClientId);
}
