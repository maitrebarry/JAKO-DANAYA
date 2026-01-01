package com.smboutique.api.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "notification")
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_notification")
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "boutique_id")
    private Long boutiqueId;

    @Column(length = 64)
    private String type;

    @Column(columnDefinition = "TEXT")
    private String payload;

    @Column(name = "is_read")
    private boolean read;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}