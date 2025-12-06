package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "reception")
public class Reception {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_reception")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "id_commande_fournisseur")
    private CommandeFournisseur commandeFournisseur;

    @ManyToOne
    @JoinColumn(name = "id_boutique")
    private Boutique boutique;

    @Column(name = "date_reception")
    private LocalDateTime dateReception;

    @Column(name = "recept_ref")
    private String reference;
}
