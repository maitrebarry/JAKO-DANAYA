package com.smboutique.api.service;

import com.smboutique.api.model.Notification;
import java.util.List;

public interface NotificationService {
    Notification createForUser(Long userId, Long boutiqueId, String type, String payload);
    List<Notification> findUnreadForUser(Long userId);
    void markRead(Long id, Long userId);
    void createForBoutiqueUsersWithPermission(Long boutiqueId, String permission, String type, String payload);
}
