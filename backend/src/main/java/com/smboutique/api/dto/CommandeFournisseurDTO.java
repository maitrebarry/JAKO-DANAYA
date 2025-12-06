package com.smboutique.api.dto;

public class CommandeFournisseurDTO {
    private Long id;
    private String reference;
    private String dateCommande;
    private FournisseurDTO fournisseur;
    private double total;
    private double montantPaye;
    private double pourcentageRecu;
    private double pourcentagePaye;

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getReference() { return reference; }
    public void setReference(String reference) { this.reference = reference; }

    public String getDateCommande() { return dateCommande; }
    public void setDateCommande(String dateCommande) { this.dateCommande = dateCommande; }

    public FournisseurDTO getFournisseur() { return fournisseur; }
    public void setFournisseur(FournisseurDTO fournisseur) { this.fournisseur = fournisseur; }

    public double getTotal() { return total; }
    public void setTotal(double total) { this.total = total; }

    public double getMontantPaye() { return montantPaye; }
    public void setMontantPaye(double montantPaye) { this.montantPaye = montantPaye; }

    public double getPourcentageRecu() { return pourcentageRecu; }
    public void setPourcentageRecu(double pourcentageRecu) { this.pourcentageRecu = pourcentageRecu; }

    public double getPourcentagePaye() { return pourcentagePaye; }
    public void setPourcentagePaye(double pourcentagePaye) { this.pourcentagePaye = pourcentagePaye; }

    public static class FournisseurDTO {
        private Long id;
        private String prenom;
        private String nom;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }

        public String getPrenom() { return prenom; }
        public void setPrenom(String prenom) { this.prenom = prenom; }

        public String getNom() { return nom; }
        public void setNom(String nom) { this.nom = nom; }
    }
}