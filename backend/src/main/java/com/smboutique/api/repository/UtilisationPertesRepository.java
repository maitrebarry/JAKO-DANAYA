package com.smboutique.api.repository;

import com.smboutique.api.model.UtilisationPertes;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UtilisationPertesRepository extends JpaRepository<UtilisationPertes, Long> {
    java.util.Optional<UtilisationPertes> findByMouvementId(Long mouvementId);
    void deleteByMouvementId(Long mouvementId);
}
