package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "ligne_commande_client")
public class LigneCommandeClient {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_ligne_cl")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "id_produit")
    private Produit produit;

    @ManyToOne
    @JoinColumn(name = "id_cmd_client")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private CommandeClient commandeClient;

    private Integer quantite;
    
    @Column(name = "qte_livre")
    private Integer quantiteLivre;
    
    @Column(name = "new_price_cmndClient")
    private Integer newPrice;

    @Enumerated(EnumType.STRING)
    @Column(name = "price_mode")
    private com.smboutique.api.model.PriceMode priceMode;
}
