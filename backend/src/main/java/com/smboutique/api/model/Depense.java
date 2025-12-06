package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;

@Entity
@Data
@Table(name = "depense")
public class Depense {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_depense")
    private Long id;

    @Column(name = "reference_caisse")
    private String referenceCaisse;

    private String libelle;
    private Integer montant;
    private LocalDate date;
    private String note;
}
