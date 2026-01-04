package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Entity
@Data
@ToString(exclude = {"stocks"})
@Table(name = "tbl_product")
@EntityListeners(AuditingEntityListener.class)
public class Produit {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_produit")
    private Long id;

    @Column(name = "nom_produit")
    private String nomProduit;

    @ManyToOne
    @JoinColumn(name = "id_unite")
    private Unite unite;

    @Column(name = "unite_conditionnement")
    private String uniteConditionnement;

    @Column(name = "nombre_unites_par_conditionnement")
    private Integer nombreUnitesParConditionnement;

    @Column(name = "product_image")
    private String productImage;

    @Column(name = "caracteristique", columnDefinition = "TEXT")
    private String caracteristique;

    @Column(name = "prix_detail")
    private Integer prixDetail;

    @Column(name = "prix_en_gros")
    private Integer prixEnGros;

    @Column(name = "prix_achat")
    private Integer prixAchat;

    @Column(name = "marge_gros")
    private BigDecimal margeGros;

    @Column(name = "marge_detail")
    private BigDecimal margeDetail;

    @Column(name = "alerte_stock")
    private Integer alerteStock;

    @CreatedDate
    @Column(name = "date_creation", updatable = false)
    private LocalDateTime dateCreation;

    @OneToMany(mappedBy = "produit", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Stock> stocks;

    @Transient
    private List<Long> magasinIds;

    @Transient
    private Integer quantiteInitialeConditionnements;

    @Transient
    private List<Map<String, Object>> magasinStocks;
}
