package com.smboutique.api.repository;

import com.smboutique.api.model.Boutique;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BoutiqueRepository extends JpaRepository<Boutique, Long> {
}
