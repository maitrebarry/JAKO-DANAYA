package com.smboutique.api.repository;

import com.smboutique.api.model.Utilisateur;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.List;

@Repository
public interface UtilisateurRepository extends JpaRepository<Utilisateur, Long> {
    Optional<Utilisateur> findByPseudo(String pseudo);
    Optional<Utilisateur> findByEmailIgnoreCase(String email);
    List<Utilisateur> findByBoutiqueId(Long boutiqueId);
}
