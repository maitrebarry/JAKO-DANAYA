package com.smboutique.api.repository;

import com.smboutique.api.model.Unite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UniteRepository extends JpaRepository<Unite, Long> {
	List<Unite> findAllByBoutiqueId(Long boutiqueId);
	Optional<Unite> findByIdAndBoutiqueId(Long id, Long boutiqueId);
    Optional<Unite> findByLibelle(String libelle);
}
