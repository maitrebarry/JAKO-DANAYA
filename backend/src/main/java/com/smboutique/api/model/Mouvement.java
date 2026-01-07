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

    @ManyToOne
    @JoinColumn(name = "id_transfer")
    private Transfer transfer;

    // Audit / context fields
    @ManyToOne
    @JoinColumn(name = "id_utilisateur")
    private Utilisateur utilisateur;

    @Column(name = "sous_type")
    private String sousType;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "reference_id")
    private Long referenceId;

    @ManyToOne
    @JoinColumn(name = "id_inventaire")
    private Inventaire inventaire;

    @Column(name = "reference_inventaire")
    private String referenceInventaire;

    @ManyToOne
    @JoinColumn(name = "id_magasin")
    private Magasin magasin;

    private Integer quantite;
    
    @Column(name = "type_mvnt")
    private String typeMouvement;
    
    private Integer montant;
    
    @Column(name = "date_mov")
    @com.fasterxml.jackson.annotation.JsonFormat(shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING, pattern = "dd/MM/yyyy HH:mm:ss")
    private LocalDateTime dateMouvement;
}
