package com.smboutique.api.repository;

import com.smboutique.api.model.Vente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface VenteRepository extends JpaRepository<Vente, Long> {
    java.util.List<Vente> findByBoutiqueId(Long boutiqueId);
}
