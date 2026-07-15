package com.smboutique.api.repository;

import com.smboutique.api.model.Mouvement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MouvementRepository extends JpaRepository<Mouvement, Long> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select m from Mouvement m where m.id = :id")
    java.util.Optional<Mouvement> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);
}
