package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "vente")
public class Vente {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_vente")
    private Long id;

    @Column(name = "nom_client")
    private String nomClient;

    @Column(name = "date_vente")
    private LocalDateTime dateVente;

    @Column(name = "montant_total")
    private Integer montantTotal;

    @Column(name = "reference_caisse")
    private String referenceCaisse;

    @ManyToOne
    @JoinColumn(name = "id_utilisateur")
    private Utilisateur utilisateur;

    // LINK TO BOUTIQUE (nullable for older rows)
    @ManyToOne
    @JoinColumn(name = "id_boutique")
    private Boutique boutique;

    private Integer remise;
    
    @Column(name = "net_a_payer")
    private Integer netAPayer;
    
    @Column(name = "montant_recu")
    private Integer montantRecu;
    
    @Column(name = "monnaie_rembourse")
    private Integer monnaieRembourse;
}
