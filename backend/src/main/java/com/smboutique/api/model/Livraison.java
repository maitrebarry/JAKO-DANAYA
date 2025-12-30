package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "livraison")
public class Livraison {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_livraison")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "id_commande_client")
    private CommandeClient commandeClient;

    @Column(name = "date_livraison")
    private LocalDateTime dateLivraison;

    @Column(name = "livraison_refer")
    private String reference;

    // Cancellation metadata
    @Column(name = "annule")
    private Boolean annule = false;

    @Column(name = "annule_at")
    private java.time.LocalDateTime annuleAt;

    @Column(name = "annule_par")
    private Long annulePar;

    @Column(name = "annule_reason")
    private String annuleReason;
}
