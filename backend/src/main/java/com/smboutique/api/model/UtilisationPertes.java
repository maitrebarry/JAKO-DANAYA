package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;

@Entity
@Data
@Table(name = "utilisation_pertes")
public class UtilisationPertes {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_utili_perte")
    private Long id;

    private String motif;
    private Integer quantite;
    private LocalDate date;
    private String type;

    @ManyToOne
    @JoinColumn(name = "id_article")
    private Produit produit;
}
