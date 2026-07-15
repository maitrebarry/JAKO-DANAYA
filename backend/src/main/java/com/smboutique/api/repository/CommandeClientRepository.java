package com.smboutique.api.repository;

import com.smboutique.api.model.CommandeClient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;

@Repository
public interface CommandeClientRepository extends JpaRepository<CommandeClient, Long> {
    java.util.List<CommandeClient> findAllByBoutiqueId(Long boutiqueId);
    java.util.Optional<CommandeClient> findByIdAndBoutiqueId(Long id, Long boutiqueId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CommandeClient c where c.id = :id")
    java.util.Optional<CommandeClient> findByIdForUpdate(@Param("id") Long id);
} 
