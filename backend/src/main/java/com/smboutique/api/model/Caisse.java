package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;

@Entity
@Data
@Table(name = "caisse", uniqueConstraints = {@UniqueConstraint(columnNames = {"id_boutique","numero"})})
public class Caisse {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_caisse")
    private Long id;

    @Column(name = "date_caisse")
    private LocalDate dateCaisse;

    @Column(name = "montant_initial")
    private Integer montantInitial;

    private String statut;

    @Column(name = "reference_caisse")
    private String reference;

    // Sequence number exposed to UI instead of raw DB id
    @Column(name = "numero")
    private Integer numero;

    // Une caisse est liée à une boutique (multi-boutique support)
    @ManyToOne
    @JoinColumn(name = "id_boutique")
    private Boutique boutique;

    @Column(name = "Montant_total_caisse")
    private Integer montantTotal;
}
