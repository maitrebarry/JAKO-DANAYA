package com.smboutique.api.repository;

import com.smboutique.api.model.Caisse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CaisseRepository extends JpaRepository<Caisse, Long> {
}
