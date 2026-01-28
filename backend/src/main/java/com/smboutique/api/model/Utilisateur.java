package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;
import java.time.LocalDateTime;
import java.util.Set;

@Entity
@Data
@ToString(exclude = {"roles", "permissions"})
@Table(name = "utilisateur")
public class Utilisateur {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_utilisateur")
    private Long id;

    @Column(name = "nom_utilisateur")
    private String nom;

    @Column(name = "prenom_utilisateur")
    private String prenom;

    @Column(name = "Contact_utilisateur")
    private String contact;

    // Transient field to receive country code from frontend when creating/updating phone
    @Transient
    private String codePays;

    private String email;

    @Column(name = "psedeau_utilisateur")
    private String pseudo;

    @Column(name = "mot_de_passe_utilisateur")
    private String motDePasse;

    private String adresse;
    private String avatar;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    @Column(name = "type_utilisateur")
    private String typeUtilisateur;

    private String statut;

    @Column(name = "reset_token")
    private String resetToken;

    @Column(name = "reset_token_expire")
    private LocalDateTime resetTokenExpire;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "boutique_id")
    private Boutique boutique;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "utilisateur_roles",
        joinColumns = @JoinColumn(name = "utilisateur_id"),
        inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<Role> roles;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "utilisateur_permissions",
        joinColumns = @JoinColumn(name = "utilisateur_id"),
        inverseJoinColumns = @JoinColumn(name = "permission_id")
    )
    private Set<Permission> permissions;
}
