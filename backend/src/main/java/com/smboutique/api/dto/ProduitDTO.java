package com.smboutique.api.dto;

import java.util.List;

public class ProduitDTO {
    private String nomProduit;
    private String productImage;
    private String caracteristique;
    private Integer prixDetail;
    private Integer prixEnGros;
    private Integer alerteStock;
    private UniteDTO unite;
    private List<Long> magasinIds;

    // Getters and setters
    public String getNomProduit() { return nomProduit; }
    public void setNomProduit(String nomProduit) { this.nomProduit = nomProduit; }

    public String getProductImage() { return productImage; }
    public void setProductImage(String productImage) { this.productImage = productImage; }

    public Integer getPrixDetail() { return prixDetail; }
    public void setPrixDetail(Integer prixDetail) { this.prixDetail = prixDetail; }

    public Integer getPrixEnGros() { return prixEnGros; }
    public void setPrixEnGros(Integer prixEnGros) { this.prixEnGros = prixEnGros; }

    public Integer getAlerteStock() { return alerteStock; }
    public void setAlerteStock(Integer alerteStock) { this.alerteStock = alerteStock; }

    public String getCaracteristique() { return caracteristique; }
    public void setCaracteristique(String caracteristique) { this.caracteristique = caracteristique; }

    public UniteDTO getUnite() { return unite; }
    public void setUnite(UniteDTO unite) { this.unite = unite; }

    public List<Long> getMagasinIds() { return magasinIds; }
    public void setMagasinIds(List<Long> magasinIds) { this.magasinIds = magasinIds; }

    public static class UniteDTO {
        private Long id;
        private String code;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }

        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
    }
}