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
    private java.util.List<LigneDTO> lignes;

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

    public java.util.List<LigneDTO> getLignes() { return lignes; }
    public void setLignes(java.util.List<LigneDTO> lignes) { this.lignes = lignes; }

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

    public static class LigneDTO {
        private Long id;
        private Long stockId;
        private Long produitId;
        private String nom;
        private Integer quantite;
        private Integer quantiteConditionnement;
        private Integer prix;
        private Double montant;
        private Integer multiplicateur;
        private UniteDTO unite;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public Long getStockId() { return stockId; }
        public void setStockId(Long stockId) { this.stockId = stockId; }
        public Long getProduitId() { return produitId; }
        public void setProduitId(Long produitId) { this.produitId = produitId; }
        public String getNom() { return nom; }
        public void setNom(String nom) { this.nom = nom; }
        public Integer getQuantite() { return quantite; }
        public void setQuantite(Integer quantite) { this.quantite = quantite; }
        public Integer getQuantiteConditionnement() { return quantiteConditionnement; }
        public void setQuantiteConditionnement(Integer quantiteConditionnement) { this.quantiteConditionnement = quantiteConditionnement; }
        public Integer getPrix() { return prix; }
        public void setPrix(Integer prix) { this.prix = prix; }
        public Double getMontant() { return montant; }
        public void setMontant(Double montant) { this.montant = montant; }
        public Integer getMultiplicateur() { return multiplicateur; }
        public void setMultiplicateur(Integer multiplicateur) { this.multiplicateur = multiplicateur; }
        public UniteDTO getUnite() { return unite; }
        public void setUnite(UniteDTO unite) { this.unite = unite; }

        public static class UniteDTO {
            private Long id;
            private String libelle;
            private String symbole;
            private String code;
            public Long getId() { return id; }
            public void setId(Long id) { this.id = id; }
            public String getLibelle() { return libelle; }
            public void setLibelle(String libelle) { this.libelle = libelle; }
            public String getSymbole() { return symbole; }
            public void setSymbole(String symbole) { this.symbole = symbole; }
            public String getCode() { return code; }
            public void setCode(String code) { this.code = code; }
        }
    }
}