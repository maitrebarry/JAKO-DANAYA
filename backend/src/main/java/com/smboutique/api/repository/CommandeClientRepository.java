package com.smboutique.api.repository;

import com.smboutique.api.model.CommandeClient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CommandeClientRepository extends JpaRepository<CommandeClient, Long> {
    java.util.List<CommandeClient> findAllByBoutiqueId(Long boutiqueId);
    java.util.Optional<CommandeClient> findByIdAndBoutiqueId(Long id, Long boutiqueId);
} 
