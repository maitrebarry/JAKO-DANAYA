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

    @ManyToOne
    @JoinColumn(name = "id_produit")
    private Produit produit;

    // Snapshots to allow safe rollback on cancellation (MVP)
    @Column(name = "before_stock_quantite")
    private Integer beforeStockQuantite;

    @Column(name = "before_stock_cost_average", precision = 19, scale = 6)
    private BigDecimal beforeStockCostAverage;

    @Column(name = "before_produit_prix_achat")
    private Integer beforeProduitPrixAchat;
}
