package com.smboutique.api.dto;

import java.util.List;

public class ReceptionDTO {
    private Long id;
    private String reference;
    private String dateReception;
    private String dateReceptionIso; // ISO string for sorting/technical use (yyyy-MM-ddTHH:mm:ss)

    private Integer timezoneOffsetMinutes; // client's timezone offset in minutes (optional)
    private Long idCommandeFournisseur;
    private String referenceCommande;
    private String fournisseur;
    private Long idBoutique;
    private List<LigneReceptionDTO> lignesReception;
    // Detailed per-line results to return (old CMP, old stock, qty received, supplier price, new CMP)
    private List<LigneReceptionResultDTO> lignesResult;

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getReference() { return reference; }
    public void setReference(String reference) { this.reference = reference; }

    public String getDateReception() { return dateReception; }
    public void setDateReception(String dateReception) { this.dateReception = dateReception; }

    public String getDateReceptionIso() { return dateReceptionIso; }
    public void setDateReceptionIso(String dateReceptionIso) { this.dateReceptionIso = dateReceptionIso; }

    public Integer getTimezoneOffsetMinutes() { return timezoneOffsetMinutes; }
    public void setTimezoneOffsetMinutes(Integer timezoneOffsetMinutes) { this.timezoneOffsetMinutes = timezoneOffsetMinutes; }

    public Long getIdCommandeFournisseur() { return idCommandeFournisseur; }
    public void setIdCommandeFournisseur(Long idCommandeFournisseur) { this.idCommandeFournisseur = idCommandeFournisseur; }

    public String getReferenceCommande() { return referenceCommande; }
    public void setReferenceCommande(String referenceCommande) { this.referenceCommande = referenceCommande; }

    public String getFournisseur() { return fournisseur; }
    public void setFournisseur(String fournisseur) { this.fournisseur = fournisseur; }

    public Long getIdBoutique() { return idBoutique; }
    public void setIdBoutique(Long idBoutique) { this.idBoutique = idBoutique; }

    public List<LigneReceptionDTO> getLignesReception() { return lignesReception; }
    public void setLignesReception(List<LigneReceptionDTO> lignesReception) { this.lignesReception = lignesReception; }

    public List<LigneReceptionResultDTO> getLignesResult() { return lignesResult; }
    public void setLignesResult(List<LigneReceptionResultDTO> lignesResult) { this.lignesResult = lignesResult; }

    public static class LigneReceptionDTO {
        private Long id;
        private Long idProduit;
        private String designation;
        private String depot;
        private Integer stock;
        private Integer qteCommande;
        private Integer qteRecue;
        private Integer receptionActuelle;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }

        public Long getIdProduit() { return idProduit; }
        public void setIdProduit(Long idProduit) { this.idProduit = idProduit; }

        public String getDesignation() { return designation; }
        public void setDesignation(String designation) { this.designation = designation; }

        public String getDepot() { return depot; }
        public void setDepot(String depot) { this.depot = depot; }

        public Integer getStock() { return stock; }
        public void setStock(Integer stock) { this.stock = stock; }

        public Integer getQteCommande() { return qteCommande; }
        public void setQteCommande(Integer qteCommande) { this.qteCommande = qteCommande; }

        public Integer getQteRecue() { return qteRecue; }
        public void setQteRecue(Integer qteRecue) { this.qteRecue = qteRecue; }

        public Integer getReceptionActuelle() { return receptionActuelle; }
        public void setReceptionActuelle(Integer receptionActuelle) { this.receptionActuelle = receptionActuelle; }
    }

    public static class LigneReceptionResultDTO {
        private Long idProduit;
        private Long idStock;
        private Integer ancienStock;
        private java.math.BigDecimal ancienCMP;
        private Integer quantiteRecue;
        private java.math.BigDecimal prixFournisseur;
        private java.math.BigDecimal nouveauCMP;
        private Integer produitPrixAchat;

        public Long getIdProduit() { return idProduit; }
        public void setIdProduit(Long idProduit) { this.idProduit = idProduit; }

        public Long getIdStock() { return idStock; }
        public void setIdStock(Long idStock) { this.idStock = idStock; }

        public Integer getAncienStock() { return ancienStock; }
        public void setAncienStock(Integer ancienStock) { this.ancienStock = ancienStock; }

        public java.math.BigDecimal getAncienCMP() { return ancienCMP; }
        public void setAncienCMP(java.math.BigDecimal ancienCMP) { this.ancienCMP = ancienCMP; }

        public Integer getQuantiteRecue() { return quantiteRecue; }
        public void setQuantiteRecue(Integer quantiteRecue) { this.quantiteRecue = quantiteRecue; }

        public java.math.BigDecimal getPrixFournisseur() { return prixFournisseur; }
        public void setPrixFournisseur(java.math.BigDecimal prixFournisseur) { this.prixFournisseur = prixFournisseur; }

        public java.math.BigDecimal getNouveauCMP() { return nouveauCMP; }
        public void setNouveauCMP(java.math.BigDecimal nouveauCMP) { this.nouveauCMP = nouveauCMP; }

        public Integer getProduitPrixAchat() { return produitPrixAchat; }
        public void setProduitPrixAchat(Integer produitPrixAchat) { this.produitPrixAchat = produitPrixAchat; }
    }
}