package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "abonnement_boutique")
public class AbonnementBoutique {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "boutique_id", referencedColumnName = "id_boutique")
    private Boutique boutique;

    @ManyToOne
    @JoinColumn(name = "plan_id")
    private AbonnementPlan plan;

    private String statut;

    @Column(name = "date_debut")
    private LocalDateTime dateDebut;

    @Column(name = "date_fin")
    private LocalDateTime dateFin;

    @Column(name = "grace_end_at")
    private LocalDateTime graceEndAt;

    @Column(name = "auto_renew")
    private Boolean autoRenew = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
}
