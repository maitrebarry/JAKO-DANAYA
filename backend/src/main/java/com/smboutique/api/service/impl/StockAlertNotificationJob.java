package com.smboutique.api.service.impl;

import com.smboutique.api.model.Stock;
import com.smboutique.api.repository.NotificationRepository;
import com.smboutique.api.service.NotificationService;
import com.smboutique.api.service.StockService;
import com.smboutique.api.service.UtilisateurService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class StockAlertNotificationJob {

    private static final Logger log = LoggerFactory.getLogger(StockAlertNotificationJob.class);

    private static final String TYPE_STOCK_ALERT = "STOCK_ALERT";

    private final StockService stockService;
    private final UtilisateurService utilisateurService;
    private final NotificationService notificationService;
    private final NotificationRepository notificationRepository;

    public StockAlertNotificationJob(
            StockService stockService,
            UtilisateurService utilisateurService,
            NotificationService notificationService,
            NotificationRepository notificationRepository
    ) {
        this.stockService = stockService;
        this.utilisateurService = utilisateurService;
        this.notificationService = notificationService;
        this.notificationRepository = notificationRepository;
    }

    // Runs periodically to create in-app notifications when stock is under or equal to the product alert threshold.
    // Dedup rule: if an unread notification with same (userId, type, payload) already exists, do not recreate.
    @Scheduled(
            fixedDelayString = "${app.notifications.stockAlert.fixedDelayMs:900000}",
            initialDelayString = "${app.notifications.stockAlert.initialDelayMs:30000}"
    )
    public void run() {
        try {
            List<Stock> stocks = stockService.getAllStocks();
            if (stocks == null || stocks.isEmpty()) return;

            // Group low stock items by boutique.
            Map<Long, List<Stock>> byShop = new HashMap<>();
            for (Stock s : stocks) {
                if (s == null || s.getBoutique() == null || s.getBoutique().getId() == null) continue;
                if (s.getProduit() == null || s.getProduit().getAlerteStock() == null) continue;

                Integer seuil = s.getProduit().getAlerteStock();
                Integer qty = s.getQuantiteDisponible();
                int q = qty == null ? 0 : qty;

                if (q <= seuil) {
                    byShop.computeIfAbsent(s.getBoutique().getId(), k -> new ArrayList<>()).add(s);
                }
            }

            if (byShop.isEmpty()) return;

            for (Map.Entry<Long, List<Stock>> entry : byShop.entrySet()) {
                Long boutiqueId = entry.getKey();
                List<Stock> lowStocks = entry.getValue();
                if (lowStocks == null || lowStocks.isEmpty()) continue;

                var users = utilisateurService.findAllByBoutiqueId(boutiqueId);
                if (users == null || users.isEmpty()) continue;

                for (var u : users) {
                    if (u == null || u.getId() == null) continue;
                    if (!isTargetUser(u)) continue;

                    for (Stock s : lowStocks) {
                        String payload = buildPayload(s);
                        if (payload == null || payload.isBlank()) continue;

                        boolean exists = notificationRepository.existsByUserIdAndReadFalseAndTypeAndPayload(u.getId(), TYPE_STOCK_ALERT, payload);
                        if (exists) continue;

                        notificationService.createForUser(u.getId(), boutiqueId, TYPE_STOCK_ALERT, payload);
                    }
                }
            }
        } catch (Exception e) {
            // Never crash the app because of notifications.
            log.warn("StockAlertNotificationJob failed: {}", e.getMessage());
        }
    }

    private boolean isTargetUser(com.smboutique.api.model.Utilisateur u) {
        if (u == null) return false;

        String type = u.getTypeUtilisateur() == null ? "" : u.getTypeUtilisateur().trim().toUpperCase(Locale.ROOT);

        boolean isOwnerType = type.equals("PROPRIETAIRE") || type.equals("ADMINISTRATEUR");
        boolean isManagerType = type.equals("GERANT") || type.equals("GERANT_BOUTIQUE") || type.equals("MANAGER");
        boolean isWarehouseType = type.equals("MAGASINIER") || type.equals("STOREKEEPER");

        boolean hasTargetRole = false;
        if (u.getRoles() != null) {
            hasTargetRole = u.getRoles().stream().anyMatch(r -> {
                if (r == null || r.getName() == null) return false;
                String rn = r.getName().trim().toUpperCase(Locale.ROOT);
                return rn.equals("PROPRIETAIRE")
                        || rn.equals("OWNER")
                        || rn.equals("ADMIN")
                        || rn.equals("ADMINISTRATEUR")
                        || rn.equals("GERANT")
                        || rn.equals("GERANT_BOUTIQUE")
                        || rn.equals("MANAGER")
                        || rn.equals("MAGASINIER")
                        || rn.equals("ROLE_MAGASINIER")
                        || rn.equals("STOREKEEPER");
            });
        }

        return isOwnerType || isManagerType || isWarehouseType || hasTargetRole;
    }

    private String buildPayload(Stock s) {
        if (s == null || s.getId() == null) return null;
        var p = s.getProduit();
        if (p == null || p.getId() == null) return null;

        String nom = p.getNomProduit() != null ? p.getNomProduit() : "Produit";
        Integer seuil = p.getAlerteStock();
        String magasin = (s.getMagasin() != null && s.getMagasin().getNom() != null) ? s.getMagasin().getNom() : "Boutique";

        // Keep payload stable to allow dedup; do not include current quantity which changes frequently.
        return "Alerte stock: " + nom + " (seuil: " + (seuil == null ? "?" : seuil) + ") - " + magasin + " (stock#" + s.getId() + ")";
    }
}
