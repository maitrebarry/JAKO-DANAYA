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

    @ManyToOne
    @JoinColumn(name = "id_commande_fournisseur")
    private CommandeFournisseur commandeFournisseur;
}
