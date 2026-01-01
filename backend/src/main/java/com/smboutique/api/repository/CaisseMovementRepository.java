package com.smboutique.api.repository;

import com.smboutique.api.model.CaisseMovement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface CaisseMovementRepository extends JpaRepository<CaisseMovement, Long> {
    List<CaisseMovement> findByReferenceCaisseOrderByCreatedAtDesc(String referenceCaisse);
    List<CaisseMovement> findByBoutiqueIdOrderByCreatedAtDesc(Long boutiqueId);
    List<CaisseMovement> findByReferenceCaisseAndCreatedAtBetweenOrderByCreatedAtDesc(String referenceCaisse, LocalDateTime from, LocalDateTime to);
}
