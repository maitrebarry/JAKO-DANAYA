package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "commande_fournisseur")
public class CommandeFournisseur {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_commande_fournisseur")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "id_fournisseur")
    private Fournisseur fournisseur;

    @Column(name = "date_de_commande")
    private LocalDateTime dateCommande;

    private String reference;
    private Integer total;
    private Integer paie;

    @ManyToOne
    @JoinColumn(name = "id_utilisateur")
    private Utilisateur utilisateur;

    @ManyToOne
    @JoinColumn(name = "id_boutique")
    private Boutique boutique;

    @OneToMany(mappedBy = "commandeFournisseur", fetch = FetchType.EAGER, cascade = CascadeType.ALL, orphanRemoval = true)
    private java.util.List<LigneCommande> lignes;
}
