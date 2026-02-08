package com.smboutique.api.repository;

import com.smboutique.api.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserIdAndReadFalseOrderByCreatedAtDesc(Long userId);

    boolean existsByUserIdAndReadFalseAndTypeAndPayload(Long userId, String type, String payload);
}