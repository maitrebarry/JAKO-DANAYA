package com.smboutique.api.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "boutique")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Boutique {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_boutique")
    private Long id;

    private String nom;
    private String quartier;
    private String adresse;
    private String indicatif;
    @com.fasterxml.jackson.annotation.JsonIgnore
    private String telephoneLocal;
    private String logo;

    // Cachet (tampon) et signature électronique de la boutique : si présents, ils s'affichent
    // automatiquement en bas de tous les documents PDF (reçus, bons, rapports...).
    private String cachet;
    private String signature;

    // Option "Revendeur" : quand activée, on peut saisir un prix revendeur par ligne de vente
    // (affiché sur le reçu uniquement) sans modifier les prix réels. Activée par le SuperAdmin.
    @Column(name = "option_revendeur")
    private Boolean optionRevendeur;

    @ManyToOne
    @JoinColumn(name = "id_pays")
    private Pays pays;
}
