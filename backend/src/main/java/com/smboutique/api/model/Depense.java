package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "depense")
public class Depense {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_depense")
    private Long id;

    @Column(length = 128)
    private String reference;

    @Column(name = "reference_caisse")
    private String referenceCaisse;

    // Raison / libellé
    private String libelle;

    // Montant en FCFA (int)
    private Integer montant;

    // Date demandée (optionnelle)
    private LocalDate date;

    // Notes complémentaires
    private String note;

    // Workflow/audit fields
    private Long boutiqueId;
    private Long createurId;

    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private com.smboutique.api.model.DepenseStatus status = com.smboutique.api.model.DepenseStatus.EN_ATTENTE;

    private Long validatorId;
    private LocalDateTime validatedAt;

    private Long annulePar;
    private LocalDateTime annuleAt;
    private String annuleReason;

    private LocalDateTime createdAt = LocalDateTime.now();
}
