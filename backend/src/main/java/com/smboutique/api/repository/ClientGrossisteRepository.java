package com.smboutique.api.repository;

import com.smboutique.api.model.ClientGrossiste;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ClientGrossisteRepository extends JpaRepository<ClientGrossiste, Long> {
}
