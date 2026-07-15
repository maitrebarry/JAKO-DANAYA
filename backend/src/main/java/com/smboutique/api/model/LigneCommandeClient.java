package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;

@Entity
@Data
@ToString(exclude = {"commandeClient"})
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

    @Column(name = "quantite_conditionnement")
    private Integer quantiteConditionnement;
    
    @Column(name = "qte_livre")
    private Integer quantiteLivre;

    @Column(name = "new_price_cmndClient")
    private Integer newPrice;

    // Which specific emballage (carton, sac...) was ordered, when the product has 2+ and the
    // caller disambiguated. Null for unit orders, single/zero-emballage products, and lines
    // predating this feature.
    @ManyToOne
    @JoinColumn(name = "id_emballage")
    private ProduitEmballage emballage;

    @Enumerated(EnumType.STRING)
    @Column(name = "price_mode")
    private com.smboutique.api.model.PriceMode priceMode;
}
