package com.smboutique.api.dto;

import java.util.List;

public class ReceptionDTO {
    private Long id;
    private String reference;
    private String dateReception;
    private Long idCommandeFournisseur;
    private String referenceCommande;
    private String fournisseur;
    private Long idBoutique;
    private List<LigneReceptionDTO> lignesReception;

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getReference() { return reference; }
    public void setReference(String reference) { this.reference = reference; }

    public String getDateReception() { return dateReception; }
    public void setDateReception(String dateReception) { this.dateReception = dateReception; }

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
}