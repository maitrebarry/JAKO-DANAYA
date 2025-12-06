package com.smboutique.api.repository;

import com.smboutique.api.model.LigneInventaire;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LigneInventaireRepository extends JpaRepository<LigneInventaire, Long> {
}
