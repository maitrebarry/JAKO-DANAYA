package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "mouvement")
public class Mouvement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_mvnt")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "id_ligne_reception")
    private LigneReception ligneReception;

    @ManyToOne
    @JoinColumn(name = "id_ligne_livraison")
    private LigneLivraison ligneLivraison;

    @ManyToOne
    @JoinColumn(name = "id_ligne_vente")
    private LigneVente ligneVente;

    @ManyToOne
    @JoinColumn(name = "id_produit")
    private Produit produit;

    @ManyToOne
    @JoinColumn(name = "id_stock")
    private Stock stock;

    @ManyToOne
    @JoinColumn(name = "id_boutique")
    private Boutique boutique;

    private Integer quantite;
    
    @Column(name = "type_mvnt")
    private String typeMouvement;
    
    private Integer montant;
    
    @Column(name = "date_mov")
    private LocalDateTime dateMouvement;
}
