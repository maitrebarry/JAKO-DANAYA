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
        private Integer prixDetail;
        private Integer prixEnGros;
        // nombre d'unités par conditionnement (ex: carton = 12)
        private Integer nombreUnitesParConditionnement;
        private UniteDTO unite;
        private java.util.List<ProduitEmballageDTO> emballages;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }

        public String getNomProduit() { return nomProduit; }
        public void setNomProduit(String nomProduit) { this.nomProduit = nomProduit; }

        public Integer getPrixAchat() { return prixAchat; }
        public void setPrixAchat(Integer prixAchat) { this.prixAchat = prixAchat; }

        public Integer getPrixDetail() { return prixDetail; }
        public void setPrixDetail(Integer prixDetail) { this.prixDetail = prixDetail; }

        public Integer getPrixEnGros() { return prixEnGros; }
        public void setPrixEnGros(Integer prixEnGros) { this.prixEnGros = prixEnGros; }

        public Integer getNombreUnitesParConditionnement() { return nombreUnitesParConditionnement; }
        public void setNombreUnitesParConditionnement(Integer nombreUnitesParConditionnement) { this.nombreUnitesParConditionnement = nombreUnitesParConditionnement; }

        public UniteDTO getUnite() { return unite; }
        public void setUnite(UniteDTO unite) { this.unite = unite; }

        public java.util.List<ProduitEmballageDTO> getEmballages() { return emballages; }
        public void setEmballages(java.util.List<ProduitEmballageDTO> emballages) { this.emballages = emballages; }

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