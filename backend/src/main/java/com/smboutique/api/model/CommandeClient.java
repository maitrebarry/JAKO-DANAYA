package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;
import java.time.LocalDateTime;

@Entity
@Data
@ToString(exclude = {"lignes"})
@Table(name = "commande_client")
public class CommandeClient {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_cmd_client")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "id_client_gr")
    private ClientGrossiste client;

    @Column(name = "date_cmd_client")
    private LocalDateTime dateCommande;

    private String reference;
    private Integer total;
    private Integer paie;

    @ManyToOne
    @JoinColumn(name = "id_utilisateur")
    private Utilisateur utilisateur;

    @ManyToOne
    @JoinColumn(name = "id_boutique")
    private Boutique boutique;

    @OneToMany(mappedBy = "commandeClient", fetch = FetchType.EAGER, cascade = CascadeType.ALL)
    private java.util.List<LigneCommandeClient> lignes;
}
