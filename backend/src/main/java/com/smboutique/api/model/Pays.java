package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "pays")
public class Pays {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_pays")
    private Long id;

    @Column(name = "code_iso", unique = true)
    private String codeIso;

    private String nom;

    private String indicatif;

    @Column(name = "devise_code")
    private String deviseCode;

    @Column(name = "devise_symbole")
    private String deviseSymbole;

    private String drapeau;
}