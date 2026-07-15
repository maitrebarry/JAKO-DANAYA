package com.smboutique.api.controller;

import java.util.List;

public class CommandeFournisseurRequest {
    private String reference;
    private String dateCommande;
    private FournisseurDTO fournisseur;
    private List<ProduitSelectionne> produitsSelectionnes;
    private double total;

    // Getters and setters
    public String getReference() { return reference; }
    public void setReference(String reference) { this.reference = reference; }

    public String getDateCommande() { return dateCommande; }
    public void setDateCommande(String dateCommande) { this.dateCommande = dateCommande; }

    public FournisseurDTO getFournisseur() { return fournisseur; }
    public void setFournisseur(FournisseurDTO fournisseur) { this.fournisseur = fournisseur; }

    public List<ProduitSelectionne> getProduitsSelectionnes() { return produitsSelectionnes; }
    public void setProduitsSelectionnes(List<ProduitSelectionne> produitsSelectionnes) { this.produitsSelectionnes = produitsSelectionnes; }

    public double getTotal() { return total; }
    public void setTotal(double total) { this.total = total; }

    public static class FournisseurDTO {
        private Long id;
        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
    }

    public static class ProduitSelectionne {
        private Long id_stock;
        private int quantite;
        private Integer quantiteConditionnement; // optional: quantity expressed in conditionnements
        private Long id_emballage; // which emballage (carton, sac...) was ordered; required only when the product has 2+
        private double prix;

        public Long getId_stock() { return id_stock; }
        public void setId_stock(Long id_stock) { this.id_stock = id_stock; }

        public int getQuantite() { return quantite; }
        public void setQuantite(int quantite) { this.quantite = quantite; }

        public Integer getQuantiteConditionnement() { return quantiteConditionnement; }
        public void setQuantiteConditionnement(Integer quantiteConditionnement) { this.quantiteConditionnement = quantiteConditionnement; }

        public Long getId_emballage() { return id_emballage; }
        public void setId_emballage(Long id_emballage) { this.id_emballage = id_emballage; }

        public double getPrix() { return prix; }
        public void setPrix(double prix) { this.prix = prix; }
    }
}