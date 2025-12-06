package com.smboutique.api.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "unite")
public class Unite {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_unite")
    private Long id;

    private String libelle;
    private String symbole;

    @Column(name = "conversion_unite")
    private Double conversionUnite;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_boutique")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Boutique boutique;
}
