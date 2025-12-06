package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "ligne_commande")
public class LigneCommande {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_ligne")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "id_stock")
    private Stock stock;

    @ManyToOne
    @JoinColumn(name = "id_commande_fournisseur")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private CommandeFournisseur commandeFournisseur;

    private Integer quantite;
    
    @Column(name = "qte_livre")
    private Integer quantiteLivre;
    
    @Column(name = "new_price_cmndFour")
    private Integer newPrice;
}
