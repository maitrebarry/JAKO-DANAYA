package com.smboutique.api.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;

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

    @ManyToOne
    @JoinColumn(name = "id_produit")
    @JsonIgnore
    private Produit produit;

    @ManyToOne
    @JoinColumn(name = "id_magasin")
    @JsonIgnore
    private Magasin magasin;
}