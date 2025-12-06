package com.smboutique.api.repository;

import com.smboutique.api.model.CommandeFournisseur;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CommandeFournisseurRepository extends JpaRepository<CommandeFournisseur, Long> {
    List<CommandeFournisseur> findAllByBoutiqueId(Long boutiqueId);
    Optional<CommandeFournisseur> findByIdAndBoutiqueId(Long id, Long boutiqueId);
}
