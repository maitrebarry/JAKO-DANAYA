package com.smboutique.api.dto;

public class TopProductDTO {
    private Long produitId;
    private String produitName;
    private long quantiteVendue;
    private long montantTotal;

    public TopProductDTO() {}

    public TopProductDTO(Long produitId, String produitName, long quantiteVendue, long montantTotal) {
        this.produitId = produitId;
        this.produitName = produitName;
        this.quantiteVendue = quantiteVendue;
        this.montantTotal = montantTotal;
    }

    public Long getProduitId() {
        return produitId;
    }

    public void setProduitId(Long produitId) {
        this.produitId = produitId;
    }

    public String getProduitName() {
        return produitName;
    }

    public void setProduitName(String produitName) {
        this.produitName = produitName;
    }

    public long getQuantiteVendue() {
        return quantiteVendue;
    }

    public void setQuantiteVendue(long quantiteVendue) {
        this.quantiteVendue = quantiteVendue;
    }

    public long getMontantTotal() {
        return montantTotal;
    }

    public void setMontantTotal(long montantTotal) {
        this.montantTotal = montantTotal;
    }
}