package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "abonnement_paiement")
public class AbonnementPaiement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "abonnement_id")
    private AbonnementBoutique abonnement;

    @Column(length = 128, unique = true)
    private String reference;

    private String provider;

    @Column(name = "mode_paiement")
    private String modePaiement;

    @Column(name = "plan_code")
    private String planCode;

    @Column(name = "transaction_ref")
    private String transactionRef;

    @Column(name = "owner_note", columnDefinition = "TEXT")
    private String ownerNote;

    @Column(name = "preuve_url")
    private String preuveUrl;

    private java.math.BigDecimal montant;

    private String devise;

    private String statut;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Column(name = "review_note", columnDefinition = "TEXT")
    private String reviewNote;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;
}
