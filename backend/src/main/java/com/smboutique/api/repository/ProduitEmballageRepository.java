package com.smboutique.api.repository;

import com.smboutique.api.model.ProduitEmballage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProduitEmballageRepository extends JpaRepository<ProduitEmballage, Long> {
    List<ProduitEmballage> findByProduitId(Long produitId);

    List<ProduitEmballage> findByProduitIdIn(java.util.Collection<Long> produitIds);

    Optional<ProduitEmballage> findByIdAndProduitId(Long id, Long produitId);

    Optional<ProduitEmballage> findFirstByProduitIdAndEstParDefautTrue(Long produitId);
}
