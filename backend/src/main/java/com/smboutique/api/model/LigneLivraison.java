package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "ligne_livraison")
public class LigneLivraison {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_ligne_livraison")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "id_livraison")
    private Livraison livraison;

    @Column(name = "quantite_recu")
    private Integer quantiteRecu;

    @ManyToOne
    @JoinColumn(name = "id_produit")
    private Produit produit;

    // Which specific emballage (carton, sac...) was delivered — mirrors the emballage recorded on
    // the originating LigneVente/LigneCommandeClient at the time the order was placed.
    @ManyToOne
    @JoinColumn(name = "id_emballage")
    private ProduitEmballage emballage;
}
