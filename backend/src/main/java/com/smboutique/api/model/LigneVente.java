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

    @Column(name = "quantite_conditionnement")
    private Integer quantiteConditionnement;
    
    @Column(name = "new_price_vente")
    private Integer newPrice;

    // Prix "revendeur" saisi pour le reçu (option boutique). N'affecte PAS le prix réel (newPrice),
    // ni la caisse, ni le stock, ni les rapports : sert uniquement à l'affichage sur le reçu + trace.
    @Column(name = "prix_revendeur")
    private Integer prixRevendeur;

    @Enumerated(EnumType.STRING)
    @Column(name = "price_mode")
    @Setter(AccessLevel.NONE)
    private PriceMode priceMode;

    @Column(name = "qte_livre")
    private Integer quantiteLivre;

    // Number of units remaining *in the (open) carton* immediately after this sale, null if no open carton
    @Column(name = "reste_unites_dans_carton_apres_vente")
    private Integer resteUnitesDansCartonApresVente;

    // Which specific emballage (carton, sac...) was sold on this line, when the product has
    // more than one and the caller disambiguated. Null for unit sales, single/zero-emballage
    // products, and any historical line predating this feature.
    @ManyToOne
    @JoinColumn(name = "id_emballage")
    private ProduitEmballage emballage;

    // Price mode must be set at creation and cannot be changed afterwards
    public void setPriceMode(PriceMode mode) {
        if (this.id != null && this.priceMode != null && !this.priceMode.equals(mode)) {
            throw new IllegalStateException("priceMode cannot be modified once set");
        }
        this.priceMode = mode;
    }
}
