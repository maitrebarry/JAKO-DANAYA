package com.smboutique.api.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "fournisseur")
public class Fournisseur {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_fournisseur")
    private Long id;

    @Column(name = "prenom_fournisseur")
    private String prenom;

    @Column(name = "nom_fournisseur")
    private String nom;

    @Column(name = "contact_fournisseur")
    private String contact;

    @Column(name = "ville_fournisseur")
    private String ville;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_boutique")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Boutique boutique;
}
