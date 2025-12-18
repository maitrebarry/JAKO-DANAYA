package com.smboutique.api.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;

@Entity
@Data
@Table(name = "stock")
public class Stock {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_stock")
    private Long id;

    @Column(name = "quantite_disponible")
    private Integer quantiteDisponible;

    @Column(name = "cost_average")
    private BigDecimal costAverage;

    @Column(name = "last_purchase_price")
    private BigDecimal lastPurchasePrice;

    @ManyToOne
    @JoinColumn(name = "id_produit")
    @JsonIgnore
    private Produit produit;

    @ManyToOne
    @JoinColumn(name = "id_magasin")
    @JsonIgnore
    private Magasin magasin;
}