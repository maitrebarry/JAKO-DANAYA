package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;

@Entity
@Data
@Table(name = "ligne_reception")
public class LigneReception {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_ligne_re")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "id_reception")
    private Reception reception;

    @Column(name = "quantite_recu")
    private Integer quantiteRecu;

    @Column(name = "quantite_conditionnement")
    private Integer quantiteConditionnement;

    @ManyToOne
    @JoinColumn(name = "id_produit")
    private Produit produit;

    // Which specific emballage (carton, sac...) was received, when the product has 2+ and the
    // caller disambiguated. Null for unit receptions, single/zero-emballage products, and lines
    // predating this feature.
    @ManyToOne
    @JoinColumn(name = "id_emballage")
    private ProduitEmballage emballage;

    // Snapshots to allow safe rollback on cancellation (MVP)
    @Column(name = "before_stock_quantite")
    private Integer beforeStockQuantite;

    @Column(name = "before_stock_cost_average", precision = 19, scale = 6)
    private BigDecimal beforeStockCostAverage;

    @Column(name = "before_produit_prix_achat")
    private Integer beforeProduitPrixAchat;
}
