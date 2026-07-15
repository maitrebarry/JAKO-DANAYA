package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "inventaire")
public class Inventaire {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_inventaire")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "id_utilisateur")
    private Utilisateur utilisateur;

    @Column(name = "date_inventaire")
    private LocalDateTime dateInventaire;

    @ManyToOne
    @JoinColumn(name = "id_boutique")
    private Boutique boutique;

    // Explicit scope: null means the inventaire counts the boutique-level stock;
    // a non-null magasin scopes it to exactly that magasin's stock.
    @ManyToOne
    @JoinColumn(name = "id_magasin")
    private Magasin magasin;

    @Column(name = "reference_inventaire")
    private String reference;

    @Column(name = "regulariser")
    private Boolean regulariser = Boolean.FALSE;
}
