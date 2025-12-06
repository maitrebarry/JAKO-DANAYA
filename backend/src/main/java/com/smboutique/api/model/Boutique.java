package com.smboutique.api.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "boutique")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Boutique {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_boutique")
    private Long id;

    private String nom;
    private String quartier;
    private String adresse;
    private String telephone;
    private String logo;
}
