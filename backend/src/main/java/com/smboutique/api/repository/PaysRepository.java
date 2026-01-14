package com.smboutique.api.repository;

import com.smboutique.api.model.Pays;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PaysRepository extends JpaRepository<Pays, Long> {
    Optional<Pays> findByCodeIso(String codeIso);
    Optional<Pays> findByIndicatif(String indicatif);
}