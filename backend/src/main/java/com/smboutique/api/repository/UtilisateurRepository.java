package com.smboutique.api.repository;

import com.smboutique.api.model.Utilisateur;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface UtilisateurRepository extends JpaRepository<Utilisateur, Long> {
    Optional<Utilisateur> findByPseudo(String pseudo);
    Optional<Utilisateur> findByEmailIgnoreCase(String email);
    Optional<Utilisateur> findByContact(String contact);
    boolean existsByContact(String contact);
    Optional<Utilisateur> findByResetToken(String resetToken);
    List<Utilisateur> findByBoutiqueId(Long boutiqueId);

    @Query("select distinct u from Utilisateur u left join fetch u.roles r left join fetch r.permissions p where u.id = :id")
    Optional<Utilisateur> findByIdWithRolesAndPermissions(@Param("id") Long id);
}
