package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "ligne_vente")
public class LigneVente {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_ligne_vente")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "id_vente")
    private Vente vente;

    @ManyToOne
    @JoinColumn(name = "id_produit")
    private Produit produit;

    private Integer quantite;
    
    @Column(name = "new_price_vente")
    private Integer newPrice;
}
