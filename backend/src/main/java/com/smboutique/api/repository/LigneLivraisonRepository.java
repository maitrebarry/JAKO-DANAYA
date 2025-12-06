package com.smboutique.api.repository;

import com.smboutique.api.model.LigneLivraison;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LigneLivraisonRepository extends JpaRepository<LigneLivraison, Long> {
}
