package com.smboutique.api.controller;

import com.smboutique.api.model.Notification;
import com.smboutique.api.service.NotificationService;
import com.smboutique.api.service.UtilisateurService;
import com.smboutique.api.repository.BoutiqueRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/notifications")
@CrossOrigin(origins = "*")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private BoutiqueRepository boutiqueRepository;

    @GetMapping
    public ResponseEntity<?> getUnread() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        var user = utilisateurService.findByEmail(auth.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        List<Notification> list = notificationService.findUnreadForUser(user.getId());

        // Enrichir les notifications avec les informations de la boutique et du pays
        List<Map<String, Object>> enrichedNotifications = list.stream().map(notification -> {
            Map<String, Object> notifMap = Map.of(
                "id", notification.getId(),
                "userId", notification.getUserId(),
                "boutiqueId", notification.getBoutiqueId(),
                "type", notification.getType(),
                "payload", notification.getPayload(),
                "read", notification.isRead(),
                "createdAt", notification.getCreatedAt()
            );

            // Ajouter les informations de la boutique si elle existe
            if (notification.getBoutiqueId() != null) {
                boutiqueRepository.findById(notification.getBoutiqueId()).ifPresent(boutique -> {
                    Map<String, Object> boutiqueInfo = Map.of(
                        "id", boutique.getId(),
                        "nom", boutique.getNom()
                    );

                    // Ajouter les informations du pays si elles existent
                    if (boutique.getPays() != null) {
                        Map<String, Object> paysInfo = Map.of(
                            "id", boutique.getPays().getId(),
                            "nom", boutique.getPays().getNom(),
                            "code", boutique.getPays().getCode(),
                            "deviseSymbole", boutique.getPays().getDeviseSymbole()
                        );
                        boutiqueInfo.put("pays", paysInfo);
                    }

                    notifMap.put("boutique", boutiqueInfo);
                });
            }

            return notifMap;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(enrichedNotifications);
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<?> markRead(@PathVariable Long id) {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        var user = utilisateurService.findByEmail(auth.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        notificationService.markRead(id, user.getId());
        return ResponseEntity.ok().<Void>build();
    }
}