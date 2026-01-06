package com.smboutique.api.repository;

import com.smboutique.api.model.LigneVente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LigneVenteRepository extends JpaRepository<LigneVente, Long> {
    List<LigneVente> findByVenteId(Long venteId);
}
