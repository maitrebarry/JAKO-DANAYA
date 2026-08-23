package com.smboutique.api.repository;

import com.smboutique.api.model.LigneVente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface LigneVenteRepository extends JpaRepository<LigneVente, Long> {
    // Le reçu PDF d'une vente chargeait auparavant findAll() (TOUTES les lignes de vente du
    // système, toutes boutiques et toute l'historique confondus) puis filtrait en Java pour ne
    // garder que celles de la vente demandée - de plus en plus lent à mesure que l'historique
    // grossit. Filtrage en SQL + produit chargé en une seule requête.
    @Query("SELECT l FROM LigneVente l LEFT JOIN FETCH l.produit WHERE l.vente.id = :venteId")
    List<LigneVente> findByVenteId(@Param("venteId") Long venteId);

    boolean existsByEmballageId(Long emballageId);

    @Query("SELECT l FROM LigneVente l JOIN l.vente v WHERE (:boutiqueId IS NULL OR v.boutique.id = :boutiqueId) AND v.dateVente >= :fromDate AND v.dateVente <= :toDate")
    List<LigneVente> findByVenteDateRangeAndBoutique(@Param("fromDate") LocalDateTime fromDate,
                                                     @Param("toDate") LocalDateTime toDate,
                                                     @Param("boutiqueId") Long boutiqueId);

    // Le tableau de bord filtrait auparavant findAll() (TOUTES les lignes de vente du système,
    // toutes boutiques confondues) en Java via lv.getVente().getBoutique() - un aller-retour BDD
    // par ligne pour charger vente puis boutique en lazy (N+1), en plus de ramener des données
    // inutiles pour les autres boutiques. Ici le filtrage se fait en SQL et produit+vente sont
    // chargés en une seule requête.
    @Query("SELECT l FROM LigneVente l JOIN FETCH l.vente v LEFT JOIN FETCH l.produit WHERE :boutiqueId IS NULL OR v.boutique.id = :boutiqueId")
    List<LigneVente> findAllForDashboard(@Param("boutiqueId") Long boutiqueId);
}
