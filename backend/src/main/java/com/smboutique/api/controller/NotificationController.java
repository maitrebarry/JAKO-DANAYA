package com.smboutique.api.controller;

import com.smboutique.api.model.Notification;
import com.smboutique.api.service.NotificationService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@CrossOrigin(origins = "*")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private UtilisateurService utilisateurService;

    @GetMapping
    public ResponseEntity<?> getUnread() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        var user = utilisateurService.findByEmail(auth.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(403).body(java.util.Map.of("error", "Accès refusé"));
        List<Notification> list = notificationService.findUnreadForUser(user.getId());
        return ResponseEntity.ok(list);
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