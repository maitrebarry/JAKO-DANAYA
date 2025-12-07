package com.smboutique.api.repository;

import com.smboutique.api.model.LigneReception;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface LigneReceptionRepository extends JpaRepository<LigneReception, Long> {
    List<LigneReception> findByReceptionId(Long receptionId);
}
