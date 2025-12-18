package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;

@Entity
@Data
@Table(name = "configuration_marge")
public class ConfigurationMarge {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_configuration_marge")
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_marge")
    private TypeMarge typeMarge;

    @Column(name = "valeur_detail")
    private BigDecimal valeurDetail;

    @Column(name = "valeur_gros")
    private BigDecimal valeurGros;

    @Column(name = "marge_minimale_detail")
    private BigDecimal margeMinimaleDetail;

    @Column(name = "marge_minimale_gros")
    private BigDecimal margeMinimaleGros;

    @ManyToOne
    @JoinColumn(name = "id_boutique")
    private Boutique boutique;

    public enum TypeMarge {
        FIXE,
        POURCENTAGE
    }
}
