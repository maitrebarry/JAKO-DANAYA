package com.smboutique.api.repository;

import com.smboutique.api.model.Inventaire;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;

@Repository
public interface InventaireRepository extends JpaRepository<Inventaire, Long> {
    java.util.List<Inventaire> findByBoutiqueId(Long boutiqueId);
    boolean existsByBoutiqueIdAndRegulariserFalse(Long boutiqueId);

    // Only a boutique-scoped active inventaire (magasin IS NULL) blocks ventes/réceptions on
    // the boutique's own stock — an active magasin inventaire never touches boutique stock.
    boolean existsByBoutiqueIdAndMagasinIsNullAndRegulariserFalse(Long boutiqueId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Inventaire i where i.id = :id")
    java.util.Optional<Inventaire> findByIdForUpdate(@Param("id") Long id);

    java.util.Optional<Inventaire> findTopByOrderByIdDesc();
}
