package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;

import java.util.List;

@Entity
@Data
@Table(name = "magasin")
public class Magasin {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_magasin")
    private Long id;

    private String nom;
    private String adresse;

    @Column(name = "type_magasin")
    private String typeMagasin;

    @ManyToOne
    @JoinColumn(name = "id_boutique")
    private Boutique boutique;

    @OneToMany(mappedBy = "magasin", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Stock> stocks;
}