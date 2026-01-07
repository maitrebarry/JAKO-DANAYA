package com.smboutique.api.repository;

import com.smboutique.api.model.Inventaire;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface InventaireRepository extends JpaRepository<Inventaire, Long> {
    java.util.List<Inventaire> findByBoutiqueId(Long boutiqueId);
    boolean existsByBoutiqueIdAndRegulariserFalse(Long boutiqueId);

    java.util.Optional<Inventaire> findTopByOrderByIdDesc();
}
