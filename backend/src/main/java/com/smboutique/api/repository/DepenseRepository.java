package com.smboutique.api.repository;

import com.smboutique.api.model.Depense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DepenseRepository extends JpaRepository<Depense, Long> {
    java.util.List<Depense> findByBoutiqueIdOrderByCreatedAtDesc(Long boutiqueId);
    java.util.List<Depense> findByStatusAndBoutiqueIdOrderByCreatedAtDesc(com.smboutique.api.model.DepenseStatus status, Long boutiqueId);
    java.util.List<Depense> findByStatusOrderByCreatedAtDesc(com.smboutique.api.model.DepenseStatus status);
    java.util.Optional<Depense> findByReference(String reference);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select d from Depense d where d.id = :id")
    java.util.Optional<Depense> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);
}
