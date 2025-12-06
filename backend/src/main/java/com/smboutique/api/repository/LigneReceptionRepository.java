package com.smboutique.api.repository;

import com.smboutique.api.model.LigneReception;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LigneReceptionRepository extends JpaRepository<LigneReception, Long> {
}
