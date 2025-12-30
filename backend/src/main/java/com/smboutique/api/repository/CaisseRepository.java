package com.smboutique.api.repository;

import com.smboutique.api.model.Caisse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface CaisseRepository extends JpaRepository<Caisse, Long> {
    // Find the most recent caisse for a boutique (useful to determine the active register)
    Optional<Caisse> findFirstByBoutiqueIdOrderByIdDesc(Long boutiqueId);

    // Get the max numero for a boutique
    @Query("SELECT MAX(c.numero) FROM Caisse c WHERE c.boutique.id = :boutiqueId")
    Integer findMaxNumeroByBoutiqueId(@Param("boutiqueId") Long boutiqueId);
}
