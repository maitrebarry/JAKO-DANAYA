package com.smboutique.api.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "caisse_transaction")
public class CaisseTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_transaction")
    private Long id;

    @Column(name = "type_tx")
    @Enumerated(EnumType.STRING)
    private TransactionType type;

    @Column(name = "montant")
    private Integer montant;

    @Column(name = "paiement_id")
    private Long paiementId;

    @Column(name = "commande_id")
    private Long commandeId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "reference_caisse")
    private String referenceCaisse;

    @Column(name = "boutique_id")
    private Long boutiqueId;

    @Column(name = "raison")
    private String raison;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public enum TransactionType { DEBIT, CREDIT, REVERSAL }

    // getters / setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public TransactionType getType() { return type; }
    public void setType(TransactionType type) { this.type = type; }
    public Integer getMontant() { return montant; }
    public void setMontant(Integer montant) { this.montant = montant; }
    public Long getPaiementId() { return paiementId; }
    public void setPaiementId(Long paiementId) { this.paiementId = paiementId; }
    public Long getCommandeId() { return commandeId; }
    public void setCommandeId(Long commandeId) { this.commandeId = commandeId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getReferenceCaisse() { return referenceCaisse; }
    public void setReferenceCaisse(String referenceCaisse) { this.referenceCaisse = referenceCaisse; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public String getRaison() { return raison; }
    public void setRaison(String raison) { this.raison = raison; }
    public Long getBoutiqueId() { return boutiqueId; }
    public void setBoutiqueId(Long boutiqueId) { this.boutiqueId = boutiqueId; }
}