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

    // Cancellation metadata
    @Column(name = "annule")
    private Boolean annule = false;

    @Column(name = "annule_at")
    private LocalDateTime annuleAt;

    @Column(name = "annule_par")
    private Long annulePar;

    @Column(name = "annule_reason")
    private String annuleReason;
}
