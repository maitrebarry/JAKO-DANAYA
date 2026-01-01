package com.smboutique.api.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "caisse_movement")
public class CaisseMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_mouvement")
    private Long id;

    @Column(name = "type_tx")
    @Enumerated(EnumType.STRING)
    private MovementType type;

    @Column(name = "montant")
    private Integer montant;

    @Column(name = "balance_before")
    private Integer balanceBefore;

    @Column(name = "balance_after")
    private Integer balanceAfter;

    @Column(name = "paiement_id")
    private Long paiementId;

    @Column(name = "commande_id")
    private Long commandeId;

    @Column(name = "depense_id")
    private Long depenseId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "reference_caisse")
    private String referenceCaisse;

    @Column(name = "boutique_id")
    private Long boutiqueId;

    @Column(name = "raison")
    private String raison;

    @Column(name = "metadata", columnDefinition = "TEXT")
    private String metadata;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public enum MovementType { DEBIT, CREDIT, REVERSAL, OPEN, CLOSE, DEPENSE, AJUSTEMENT }

    // getters / setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public MovementType getType() { return type; }
    public void setType(MovementType type) { this.type = type; }
    public Integer getMontant() { return montant; }
    public void setMontant(Integer montant) { this.montant = montant; }
    public Integer getBalanceBefore() { return balanceBefore; }
    public void setBalanceBefore(Integer balanceBefore) { this.balanceBefore = balanceBefore; }
    public Integer getBalanceAfter() { return balanceAfter; }
    public void setBalanceAfter(Integer balanceAfter) { this.balanceAfter = balanceAfter; }
    public Long getPaiementId() { return paiementId; }
    public void setPaiementId(Long paiementId) { this.paiementId = paiementId; }
    public Long getCommandeId() { return commandeId; }
    public void setCommandeId(Long commandeId) { this.commandeId = commandeId; }
    public Long getDepenseId() { return depenseId; }
    public void setDepenseId(Long depenseId) { this.depenseId = depenseId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getReferenceCaisse() { return referenceCaisse; }
    public void setReferenceCaisse(String referenceCaisse) { this.referenceCaisse = referenceCaisse; }
    public Long getBoutiqueId() { return boutiqueId; }
    public void setBoutiqueId(Long boutiqueId) { this.boutiqueId = boutiqueId; }
    public String getRaison() { return raison; }
    public void setRaison(String raison) { this.raison = raison; }
    public String getMetadata() { return metadata; }
    public void setMetadata(String metadata) { this.metadata = metadata; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
