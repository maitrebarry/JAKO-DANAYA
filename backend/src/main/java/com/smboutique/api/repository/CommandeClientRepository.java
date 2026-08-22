package com.smboutique.api.repository;

import com.smboutique.api.model.CommandeClient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;

@Repository
public interface CommandeClientRepository extends JpaRepository<CommandeClient, Long> {
    // lignes est déclaré FetchType.EAGER sur l'entité, mais sans JOIN FETCH explicite Hibernate
    // exécute quand même une requête séparée par commande pour les charger (N+1) ; le tableau de
    // bord appelle cette méthode plusieurs fois par requête et devenait très lent dès que la
    // boutique avait plus qu'une poignée de commandes. Un seul JOIN FETCH regroupe tout en une requête.
    // c.client (ClientGrossiste) est lazy par défaut et était lu par la liste "commandes clients"
    // pour chaque ligne -> une requête par client distinct ; ajouté au JOIN FETCH pour l'éviter.
    @Query("SELECT DISTINCT c FROM CommandeClient c LEFT JOIN FETCH c.lignes l LEFT JOIN FETCH l.produit LEFT JOIN FETCH c.client WHERE c.boutique.id = :boutiqueId")
    java.util.List<CommandeClient> findAllByBoutiqueId(@Param("boutiqueId") Long boutiqueId);
    java.util.Optional<CommandeClient> findByIdAndBoutiqueId(Long id, Long boutiqueId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CommandeClient c where c.id = :id")
    java.util.Optional<CommandeClient> findByIdForUpdate(@Param("id") Long id);
} 
