package com.smboutique.api.repository;

import com.smboutique.api.model.LigneLivraison;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

@Repository
public interface LigneLivraisonRepository extends JpaRepository<LigneLivraison, Long> {
    @Query("select ll from LigneLivraison ll where ll.livraison is not null and ll.livraison.id = :lid")
    List<LigneLivraison> findByLivraisonId(@Param("lid") Long livraisonId);
}
