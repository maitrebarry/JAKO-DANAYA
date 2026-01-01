package com.smboutique.api.service.impl;

import com.smboutique.api.model.Notification;
import com.smboutique.api.repository.NotificationRepository;
import com.smboutique.api.service.NotificationService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class NotificationServiceImpl implements NotificationService {

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UtilisateurService utilisateurService;

    @Override
    public Notification createForUser(Long userId, Long boutiqueId, String type, String payload) {
        Notification n = new Notification();
        n.setUserId(userId);
        n.setBoutiqueId(boutiqueId);
        n.setType(type);
        n.setPayload(payload);
        n.setRead(false);
        return notificationRepository.save(n);
    }

    @Override
    public List<Notification> findUnreadForUser(Long userId) {
        return notificationRepository.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId);
    }

    @Override
    public void markRead(Long id, Long userId) {
        notificationRepository.findById(id).ifPresent(n -> {
            if (n.getUserId().equals(userId)) {
                n.setRead(true);
                notificationRepository.save(n);
            }
        });
    }

    @Override
    public void createForBoutiqueUsersWithPermission(Long boutiqueId, String permission, String type, String payload) {
        if (boutiqueId == null) return;
        var users = utilisateurService.findAllByBoutiqueId(boutiqueId);
        for (var u : users) {
            if (utilisateurService.hasPermission(u, permission)) {
                createForUser(u.getId(), boutiqueId, type, payload);
            }
        }
    }
}
