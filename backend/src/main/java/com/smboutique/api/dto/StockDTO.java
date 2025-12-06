package com.smboutique.api.dto;

public class StockDTO {
    private Long id;
    private Integer quantiteDisponible;
    private Integer prixAchat;
    private ProduitDTO produit;
    private MagasinDTO magasin;

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Integer getQuantiteDisponible() { return quantiteDisponible; }
    public void setQuantiteDisponible(Integer quantiteDisponible) { this.quantiteDisponible = quantiteDisponible; }

    public Integer getPrixAchat() { return prixAchat; }
    public void setPrixAchat(Integer prixAchat) { this.prixAchat = prixAchat; }

    public ProduitDTO getProduit() { return produit; }
    public void setProduit(ProduitDTO produit) { this.produit = produit; }

    public MagasinDTO getMagasin() { return magasin; }
    public void setMagasin(MagasinDTO magasin) { this.magasin = magasin; }

    public static class ProduitDTO {
        private Long id;
        private String nomProduit;
        private Integer prixAchat;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }

        public String getNomProduit() { return nomProduit; }
        public void setNomProduit(String nomProduit) { this.nomProduit = nomProduit; }

        public Integer getPrixAchat() { return prixAchat; }
        public void setPrixAchat(Integer prixAchat) { this.prixAchat = prixAchat; }
    }

    public static class MagasinDTO {
        private Long id;
        private String nom;
        private String adresse;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }

        public String getNom() { return nom; }
        public void setNom(String nom) { this.nom = nom; }

        public String getAdresse() { return adresse; }
        public void setAdresse(String adresse) { this.adresse = adresse; }
    }
}