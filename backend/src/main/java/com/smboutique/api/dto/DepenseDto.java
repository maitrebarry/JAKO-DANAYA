package com.smboutique.api.dto;

import com.smboutique.api.model.Depense;
import com.smboutique.api.model.DepenseStatus;

import java.time.LocalDateTime;

public class DepenseDto {
    public Long id;
    public String reference;
    public Integer montant;
    public String libelle;
    public String note;
    public Long boutiqueId;
    public Long createurId;
    public DepenseStatus status;
    public String referenceCaisse;
    public Long validatorId;
    public LocalDateTime validatedAt;
    public Long annulePar;
    public LocalDateTime annuleAt;
    public String annuleReason;
    public LocalDateTime createdAt;

    public DepenseDto() {}

    public DepenseDto(Depense d) {
        this.id = d.getId();
        this.reference = d.getReference();
        this.montant = d.getMontant();
        this.libelle = d.getLibelle();
        this.note = d.getNote();
        this.boutiqueId = d.getBoutiqueId();
        this.createurId = d.getCreateurId();
        this.status = d.getStatus();
        this.referenceCaisse = d.getReferenceCaisse();
        this.validatorId = d.getValidatorId();
        this.validatedAt = d.getValidatedAt();
        this.annulePar = d.getAnnulePar();
        this.annuleAt = d.getAnnuleAt();
        this.annuleReason = d.getAnnuleReason();
        this.createdAt = d.getCreatedAt();
    }
}