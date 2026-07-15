package com.smboutique.api.repository;

import com.smboutique.api.model.LigneVente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface LigneVenteRepository extends JpaRepository<LigneVente, Long> {
    List<LigneVente> findByVenteId(Long venteId);

    boolean existsByEmballageId(Long emballageId);

    @Query("SELECT l FROM LigneVente l JOIN l.vente v WHERE (:boutiqueId IS NULL OR v.boutique.id = :boutiqueId) AND v.dateVente >= :fromDate AND v.dateVente <= :toDate")
    List<LigneVente> findByVenteDateRangeAndBoutique(@Param("fromDate") LocalDateTime fromDate,
                                                     @Param("toDate") LocalDateTime toDate,
                                                     @Param("boutiqueId") Long boutiqueId);
}
