package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "client_grossiste")
public class ClientGrossiste {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_client_gr")
    private Long id;

    @Column(name = "nom_client_grossiste")
    private String nom;

    @Column(name = "prenom_du_client_grossiste")
    private String prenom;

    @Column(name = "ville_client_grossiste")
    private String ville;

    @Column(name = "contact_client_grossiste")
    private String contact;

    @Transient
    private String codePays;
}
