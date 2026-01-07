package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "ligne_inventaire")
public class LigneInventaire {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_ligne_inventaire")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "id_produit")
    private Produit produit;

    @ManyToOne
    @JoinColumn(name = "id_inventaire")
    private Inventaire inventaire;

    @Column(name = "quantite_physique")
    private Integer quantitePhysique;

    @Column(name = "ecart_stock")
    private Integer ecartStock;

    @Column(name = "montant")
    private Integer montant;
}
