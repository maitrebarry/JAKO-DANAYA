package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Data
@Table(name = "transfer")
public class Transfer {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_transfer")
    private Long id;

    @Column(name = "source_type")
    private String sourceType; // BOUTIQUE or MAGASIN

    @Column(name = "source_id")
    private Long sourceId; // magasin id or boutique id

    @Column(name = "dest_type")
    private String destType; // BOUTIQUE or MAGASIN

    @Column(name = "dest_id")
    private Long destId; // magasin id or boutique id

    @ManyToOne
    @JoinColumn(name = "id_utilisateur")
    private Utilisateur utilisateur;

    @Column(name = "date_transfer")
    private LocalDateTime dateTransfer;
}
