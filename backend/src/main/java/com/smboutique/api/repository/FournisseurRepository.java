package com.smboutique.api.repository;

import com.smboutique.api.model.Fournisseur;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FournisseurRepository extends JpaRepository<Fournisseur, Long> {
	List<Fournisseur> findAllByBoutiqueId(Long boutiqueId);
	Optional<Fournisseur> findByIdAndBoutiqueId(Long id, Long boutiqueId);
}
