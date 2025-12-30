package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "paiement_client")
public class PaiementClient {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_paie_client")
    private Long id;

    @Column(name = "montant_paye")
    private Integer montantPaye;

    @Column(name = "date_paie")
    private LocalDateTime datePaie;

    @Column(name = "paie_reference")
    private String reference;

    @ManyToOne
    @JoinColumn(name = "id_comnd_client")
    private CommandeClient commandeClient;

    @Column(name = "reference_caisse")
    private String referenceCaisse;

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
