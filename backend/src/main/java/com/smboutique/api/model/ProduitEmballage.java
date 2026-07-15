package com.smboutique.api.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "produit_emballage")
@EntityListeners(AuditingEntityListener.class)
public class ProduitEmballage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_emballage")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "id_produit")
    @JsonIgnore
    private Produit produit;

    @ManyToOne
    @JoinColumn(name = "id_unite")
    private Unite unite;

    @Column(name = "nombre_unites")
    private Integer nombreUnites;

    @Column(name = "est_par_defaut")
    private Boolean estParDefaut = false;

    @CreatedDate
    @Column(name = "date_creation", updatable = false)
    private LocalDateTime dateCreation;
}
