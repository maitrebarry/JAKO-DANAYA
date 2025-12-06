package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;

@Entity
@Data
@Table(name = "caisse")
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

    @Column(name = "Montant_total_caisse")
    private Integer montantTotal;
}
