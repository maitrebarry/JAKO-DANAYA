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

    // Derived designation used by templates and DTOs when explicit designation is not stored
    public String getDesignation() {
        if (this.stock != null && this.stock.getProduit() != null) {
            return this.stock.getProduit().getNomProduit();
        }
        return null;
    }

    // Expose a 'price' property to templates (some templates check 'ligne.price').
    // Prefer explicit price field if added later; otherwise fall back to newPrice or stock produit prixAchat.
    public Integer getPrice() {
        if (this.newPrice != null) return this.newPrice;
        if (this.stock != null && this.stock.getProduit() != null && this.stock.getProduit().getPrixAchat() != null) return this.stock.getProduit().getPrixAchat();
        return null;
    }

    // Provide montant property expected by templates: price * quantite
    public Integer getMontant() {
        Integer price = getPrice();
        Integer q = this.quantite != null ? this.quantite : 0;
        if (price == null) return null;
        try {
            return price * q;
        } catch (Exception e) {
            return null;
        }
    }
}
