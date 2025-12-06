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

    private String boutique;

    @Column(name = "reference_inventaire")
    private String reference;

    private String regulariser;
}
