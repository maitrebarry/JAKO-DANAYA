package com.smboutique.api.dto;

public class UtilisationRequest {
    public Long produitId;
    public Long magasinId; // optional
    public Integer quantite;
    public String sousType; // UTILISATION | PERTE
    public String description;

    public UtilisationRequest() {}

    public UtilisationRequest(Long produitId, Long magasinId, Integer quantite, String sousType, String description) {
        this.produitId = produitId;
        this.magasinId = magasinId;
        this.quantite = quantite;
        this.sousType = sousType;
        this.description = description;
    }
}
