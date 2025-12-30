package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "paiement")
public class Paiement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_paiement")
    private Long id;

    @Column(name = "montant_paye")
    private Integer montantPaye;

    @Column(name = "date_paie")
    private LocalDateTime datePaie;

    @Column(name = "paie_referrence")
    private String reference;

    @Column(name = "reference_caisse")
    private String referenceCaisse;

    @ManyToOne
    @JoinColumn(name = "id_commande_fournisseur")
    private CommandeFournisseur commandeFournisseur;

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
