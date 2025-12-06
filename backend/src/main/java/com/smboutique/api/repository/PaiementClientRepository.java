package com.smboutique.api.repository;

import com.smboutique.api.model.PaiementClient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PaiementClientRepository extends JpaRepository<PaiementClient, Long> {
}
