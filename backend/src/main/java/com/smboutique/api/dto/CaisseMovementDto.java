package com.smboutique.api.dto;

import com.smboutique.api.model.CaisseMovement;
import java.time.LocalDateTime;

public class CaisseMovementDto {
    private Long id;
    private LocalDateTime createdAt;
    private CaisseMovement.MovementType type;
    private Integer montant;
    private Integer balanceBefore;
    private Integer balanceAfter;
    private String referenceCaisse;
    private Long boutiqueId;

    private Long commandeId;
    private String commandeReference;

    private Long paiementId;
    private String paiementReference;

    private Long userId;
    private String userFullName;

    private String raison;
    private String metadata;

    // computed human friendly label for the type (e.g. "Entree CMC", "ENTREE-VTE-DIRECT", "SORTIE-DEPENSE")
    private String typeLabel;

    private String deviseSymbole;

    public CaisseMovementDto() {}

    public CaisseMovementDto(CaisseMovement cm) {
        this.id = cm.getId();
        this.createdAt = cm.getCreatedAt();
        this.type = cm.getType();
        this.montant = cm.getMontant();
        this.balanceBefore = cm.getBalanceBefore();
        this.balanceAfter = cm.getBalanceAfter();
        this.referenceCaisse = cm.getReferenceCaisse();
        this.boutiqueId = cm.getBoutiqueId();
        this.commandeId = cm.getCommandeId();
        this.paiementId = cm.getPaiementId();
        this.userId = cm.getUserId();
        this.raison = cm.getRaison();
        this.metadata = cm.getMetadata();
        // default typeLabel to enum name until enriched by service logic
        this.typeLabel = cm.getType() != null ? cm.getType().name() : null;
    }

    // getters / setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public CaisseMovement.MovementType getType() { return type; }
    public void setType(CaisseMovement.MovementType type) { this.type = type; }
    public Integer getMontant() { return montant; }
    public void setMontant(Integer montant) { this.montant = montant; }
    public Integer getBalanceBefore() { return balanceBefore; }
    public void setBalanceBefore(Integer balanceBefore) { this.balanceBefore = balanceBefore; }
    public Integer getBalanceAfter() { return balanceAfter; }
    public void setBalanceAfter(Integer balanceAfter) { this.balanceAfter = balanceAfter; }
    public String getReferenceCaisse() { return referenceCaisse; }
    public void setReferenceCaisse(String referenceCaisse) { this.referenceCaisse = referenceCaisse; }
    public Long getBoutiqueId() { return boutiqueId; }
    public void setBoutiqueId(Long boutiqueId) { this.boutiqueId = boutiqueId; }
    public Long getCommandeId() { return commandeId; }
    public void setCommandeId(Long commandeId) { this.commandeId = commandeId; }
    public String getCommandeReference() { return commandeReference; }
    public void setCommandeReference(String commandeReference) { this.commandeReference = commandeReference; }
    public Long getPaiementId() { return paiementId; }
    public void setPaiementId(Long paiementId) { this.paiementId = paiementId; }
    public String getPaiementReference() { return paiementReference; }
    public void setPaiementReference(String paiementReference) { this.paiementReference = paiementReference; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getUserFullName() { return userFullName; }
    public void setUserFullName(String userFullName) { this.userFullName = userFullName; }
    public String getRaison() { return raison; }
    public void setRaison(String raison) { this.raison = raison; }
    public String getMetadata() { return metadata; }
    public void setMetadata(String metadata) { this.metadata = metadata; }

    public String getTypeLabel() { return typeLabel; }
    public void setTypeLabel(String typeLabel) { this.typeLabel = typeLabel; }

    public String getDeviseSymbole() { return deviseSymbole; }
    public void setDeviseSymbole(String deviseSymbole) { this.deviseSymbole = deviseSymbole; }
}
