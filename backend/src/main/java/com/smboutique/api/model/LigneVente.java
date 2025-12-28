package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.Setter;
import lombok.AccessLevel;

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

    @Enumerated(EnumType.STRING)
    @Column(name = "price_mode")
    @Setter(AccessLevel.NONE)
    private PriceMode priceMode;

    @Column(name = "qte_livre")
    private Integer quantiteLivre;

    // Price mode must be set at creation and cannot be changed afterwards
    public void setPriceMode(PriceMode mode) {
        if (this.id != null && this.priceMode != null && !this.priceMode.equals(mode)) {
            throw new IllegalStateException("priceMode cannot be modified once set");
        }
        this.priceMode = mode;
    }
}
