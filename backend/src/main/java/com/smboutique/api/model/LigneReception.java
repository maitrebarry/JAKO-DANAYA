package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "ligne_reception")
public class LigneReception {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_ligne_re")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "id_reception")
    private Reception reception;

    @Column(name = "quantite_recu")
    private Integer quantiteRecu;

    @ManyToOne
    @JoinColumn(name = "id_produit")
    private Produit produit;
}
