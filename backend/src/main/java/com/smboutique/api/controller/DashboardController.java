package com.smboutique.api.controller;

import com.smboutique.api.model.CommandeClient;
import com.smboutique.api.model.LigneCommandeClient;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.CommandeClientService;
import com.smboutique.api.service.UtilisateurService;
import com.smboutique.api.service.StockService;
import com.smboutique.api.service.dto.DashboardOverviewDTO;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final CommandeClientService commandeClientService;
    private final UtilisateurService utilisateurService;
    private final StockService stockService;
    private final com.smboutique.api.service.DashboardService dashboardService;

    private final com.smboutique.api.repository.BoutiqueRepository boutiqueRepository;

    public DashboardController(CommandeClientService commandeClientService, UtilisateurService utilisateurService, StockService stockService, com.smboutique.api.service.DashboardService dashboardService, com.smboutique.api.repository.BoutiqueRepository boutiqueRepository) {
        this.commandeClientService = commandeClientService;
        this.utilisateurService = utilisateurService;
        this.stockService = stockService;
        this.dashboardService = dashboardService;
        this.boutiqueRepository = boutiqueRepository;
    }

    @GetMapping("/overview")
    public DashboardOverviewDTO overview(@RequestParam(value = "shopId", required = false) Long shopId) {
        return dashboardService.getOverview(shopId);
    }

    @GetMapping("")
    public Map<String, Object> dashboard(@RequestParam(value = "shopId", required = false) Long shopId) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return Map.of("error", "Authentification requise");
        }
        String email = authentication.getName();
        Utilisateur utilisateur = utilisateurService.findByEmail(email).orElse(null);
        if (utilisateur == null) {
            return Map.of("error", "Utilisateur non trouvé");
        }

        String typeUtilisateur = utilisateur.getTypeUtilisateur() != null ? utilisateur.getTypeUtilisateur().toUpperCase() : "";
        java.util.Set<String> roleNames = new java.util.HashSet<>();
        if (utilisateur.getRoles() != null) {
            utilisateur.getRoles().forEach(r -> { if (r.getName() != null) roleNames.add(r.getName().toUpperCase()); });
        }

        boolean isSuperAdmin = "SUPERADMIN".equalsIgnoreCase(typeUtilisateur) || roleNames.contains("SUPERADMIN") || roleNames.contains("ROLE_SUPERADMIN");
        boolean isOwner = "PROPRIETAIRE".equalsIgnoreCase(typeUtilisateur) || roleNames.contains("PROPRIETAIRE") || roleNames.contains("OWNER") || roleNames.contains("ROLE_PROPRIETAIRE") || roleNames.contains("ADMIN") || roleNames.contains("ADMINISTRATEUR");
        boolean isManager = "GERANT_BOUTIQUE".equalsIgnoreCase(typeUtilisateur) || roleNames.contains("GERANT_BOUTIQUE") || roleNames.contains("MANAGER") || roleNames.contains("ROLE_MANAGER");
        boolean isCashier = "CAISSIER".equalsIgnoreCase(typeUtilisateur) || roleNames.contains("CAISSIER") || roleNames.contains("CASHIER") || roleNames.contains("ROLE_CASHIER");
        boolean isWarehouse = "MAGASINIER".equalsIgnoreCase(typeUtilisateur) || roleNames.contains("MAGASINIER") || roleNames.contains("ROLE_MAGASINIER") || roleNames.contains("STOREKEEPER");

        Long targetBoutiqueId = null;
        if (isSuperAdmin) {
            targetBoutiqueId = shopId; // global if not provided
        } else {
            if (utilisateur.getBoutique() != null) {
                targetBoutiqueId = utilisateur.getBoutique().getId();
            } else if (shopId != null) {
                return Map.of("error", "Accès à la boutique refusé");
            }
        }

        final Long finalTargetBoutiqueId = targetBoutiqueId;

        Map<String,Object> widgets = new HashMap<>();
        String role = "USER";

        // Use dashboardService for common metrics
        com.smboutique.api.service.dto.DashboardOverviewDTO dto = dashboardService.getOverview(finalTargetBoutiqueId);

        if (isSuperAdmin) {
            role = "SUPERADMIN";
            widgets.put("shopsCount", boutiqueRepository.count());
            widgets.put("usersCount", utilisateurService.findAll().size());
            widgets.put("systemErrors", 0); // use admin alerts endpoint for details
            widgets.put("volumes", dto.getSalesTotal());
            widgets.put("servicesStatus", Map.of("api","OK","db","OK"));
        } else if (isOwner) {
            role = "PROPRIETAIRE";
            widgets.put("chiffre_affaires_total", dto.getSalesTotal());
            widgets.put("salesByShop", List.of(Map.of("id", finalTargetBoutiqueId, "sales", dto.getSalesTotal())));
            // compute simple stock value using stockService
            double stockValue = stockService.getAllStocks().stream()
                    .filter(s -> s.getBoutique() != null && s.getBoutique().getId().equals(finalTargetBoutiqueId))
                    .map(s -> {
                        java.math.BigDecimal price = s.getLastPurchasePrice() != null ? s.getLastPurchasePrice() : (s.getCostAverage() != null ? s.getCostAverage() : java.math.BigDecimal.ZERO);
                        java.math.BigDecimal q = s.getQuantiteDisponible() != null ? java.math.BigDecimal.valueOf(s.getQuantiteDisponible()) : java.math.BigDecimal.ZERO;
                        return price.multiply(q);
                    }).reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add).doubleValue();
            widgets.put("valeur_stock", stockValue);
            widgets.put("top_products", dto.getTopProducts());
            widgets.put("summary_caisse", Map.of("salesToday", dto.getSalesToday() != null ? dto.getSalesToday() : 0L, "pendingOrders", dto.getPendingOrders() != null ? dto.getPendingOrders() : 0L));
            widgets.put("evolution_ventes", Map.of("salesToday", dto.getSalesToday() != null ? dto.getSalesToday() : 0L, "sales7d", dto.getSales7d() != null ? dto.getSales7d() : List.of()));
        } else if (isManager) {
            role = "GERANT";
            widgets.put("ventes_jour", dto.getSalesToday());
            widgets.put("stock_critique", dto.getLowStockCount());
            double stockValue = stockService.getAllStocks().stream()
                    .filter(s -> s.getBoutique() != null && s.getBoutique().getId().equals(finalTargetBoutiqueId))
                    .map(s -> {
                        java.math.BigDecimal price = s.getLastPurchasePrice() != null ? s.getLastPurchasePrice() : (s.getCostAverage() != null ? s.getCostAverage() : java.math.BigDecimal.ZERO);
                        java.math.BigDecimal q = s.getQuantiteDisponible() != null ? java.math.BigDecimal.valueOf(s.getQuantiteDisponible()) : java.math.BigDecimal.ZERO;
                        return price.multiply(q);
                    }).reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add).doubleValue();
            widgets.put("valeur_stock_boutique", stockValue);
            widgets.put("inventaire_actif", false);
            widgets.put("mouvements_recents", List.of());
            widgets.put("resume_caisse_jour", Map.of("salesToday", dto.getSalesToday(), "pendingOrders", dto.getPendingOrders()));
        } else if (isWarehouse) {
            role = "MAGASINIER";
            widgets.put("produits_en_rupture", dto.getLowStockCount());
            widgets.put("produits_sous_seuil", dto.getLowStockCount());
            double stockValue = stockService.getAllStocks().stream()
                    .filter(s -> s.getBoutique() != null && s.getBoutique().getId().equals(finalTargetBoutiqueId))
                    .map(s -> {
                        java.math.BigDecimal price = s.getLastPurchasePrice() != null ? s.getLastPurchasePrice() : (s.getCostAverage() != null ? s.getCostAverage() : java.math.BigDecimal.ZERO);
                        java.math.BigDecimal q = s.getQuantiteDisponible() != null ? java.math.BigDecimal.valueOf(s.getQuantiteDisponible()) : java.math.BigDecimal.ZERO;
                        return price.multiply(q);
                    }).reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add).doubleValue();
            widgets.put("valeur_stock_magasin", stockValue);
            widgets.put("receptions_recentes", List.of());
            widgets.put("ajustements_recents", List.of());
        } else if (isCashier) {
            role = "CAISSIER";
            widgets.put("ventes_jour_personnelles", personalSalesForUser(utilisateur.getId(), finalTargetBoutiqueId));
            widgets.put("etat_caisse", Map.of("open", true));
            widgets.put("historique_ventes", List.of());
            widgets.put("alertes_simples", List.of());
        } else {
            role = "USER";
            widgets.put("salesToday", dto.getSalesToday());
            widgets.put("pendingOrders", dto.getPendingOrders());
        }

        Map<String,Object> resp = new HashMap<>();
        resp.put("role", role);
        resp.put("widgets", widgets);
        if (utilisateur.getBoutique() != null) resp.put("currentBoutique", Map.of("id", utilisateur.getBoutique().getId(), "nom", utilisateur.getBoutique().getNom()));
        return resp;
    }

    // helper: personal sales by user for a boutique
    private long personalSalesForUser(Long userId, Long boutiqueId) {
        if (userId == null) return 0L;
        List<CommandeClient> commandes = (boutiqueId == null) ? commandeClientService.findAll() : commandeClientService.findAllByBoutiqueId(boutiqueId);
        return commandes.stream().filter(c -> c.getUtilisateur() != null && userId.equals(c.getUtilisateur().getId()))
                .mapToLong(c -> c.getTotal() == null ? 0L : c.getTotal().longValue()).sum();
    }

    @GetMapping("/shops/{id}/overview")
    @PreAuthorize("hasAnyRole('SUPERADMIN','PROPRIETAIRE','ADMINISTRATEUR','MANAGER')")
    public ShopOverviewDTO shopOverview(@PathVariable("id") Long boutiqueId) {
        List<CommandeClient> commandes = commandeClientService.findAllByBoutiqueId(boutiqueId);
        ShopOverviewDTO dto = new ShopOverviewDTO();
        long salesTotal = commandes.stream().mapToLong(c -> c.getTotal() == null ? 0L : c.getTotal().longValue()).sum();
        dto.salesTotal = salesTotal;

        LocalDateTime start = LocalDate.now().atStartOfDay();
        LocalDateTime end = LocalDateTime.now();
        // sales for last 7 days
        List<Long> last7 = new ArrayList<>();
        for (int d = 6; d >= 0; d--) {
            LocalDate day = LocalDate.now().minusDays(d);
            LocalDateTime s = day.atStartOfDay();
            LocalDateTime e = day.atTime(LocalTime.MAX);
            long sum = commandes.stream().filter(c -> c.getDateCommande() != null && !c.getDateCommande().isBefore(s) && !c.getDateCommande().isAfter(e)).mapToLong(c -> c.getTotal() == null ? 0L : c.getTotal().longValue()).sum();
            last7.add(sum);
        }
        dto.sales7d = last7;

        long pending = commandes.stream().filter(c -> c.getTotal() != null && (c.getPaie() == null || c.getPaie().intValue() < c.getTotal().intValue())).count();
        dto.pendingOrders = pending;

        // top products by aggregating lignes
        Map<Long, ProductAgg> agg = new HashMap<>();
        for (CommandeClient c : commandes) {
            if (c.getLignes() == null) continue;
            for (LigneCommandeClient l : c.getLignes()) {
                if (l.getProduit() == null) continue;
                long pid = l.getProduit().getId();
                String pname = l.getProduit().getNomProduit();
                ProductAgg pa = agg.computeIfAbsent(pid, k -> new ProductAgg(k, pname, 0L));
                pa.sold += (l.getQuantite() == null ? 0L : l.getQuantite());
            }
        }
        dto.topProducts = agg.values().stream().sorted((a,b)->Long.compare(b.sold,a.sold)).limit(10).map(p->new TopProduct(p.id,p.name,p.sold)).collect(Collectors.toList());

        return dto;
    }

    @GetMapping("/shop/{id}/sales-today")
    @PreAuthorize("hasAnyRole('SUPERADMIN','PROPRIETAIRE','ADMINISTRATEUR','MANAGER')")
    public Map<String, Long> shopSalesToday(@PathVariable("id") Long boutiqueId) {
        List<CommandeClient> commandes = commandeClientService.findAllByBoutiqueId(boutiqueId);
        LocalDateTime start = LocalDate.now().atStartOfDay();
        LocalDateTime end = LocalDateTime.now();
        long sum = commandes.stream().filter(c -> c.getDateCommande() != null && !c.getDateCommande().isBefore(start) && !c.getDateCommande().isAfter(end)).mapToLong(c -> c.getTotal() == null ? 0L : c.getTotal().longValue()).sum();
        return Collections.singletonMap("salesToday", sum);
    }

    @GetMapping("/shop/{id}/orders/pending")
    @PreAuthorize("hasAnyRole('SUPERADMIN','PROPRIETAIRE','ADMINISTRATEUR','MANAGER')")
    public List<PendingOrderDTO> shopPendingOrders(@PathVariable("id") Long boutiqueId) {
        List<CommandeClient> commandes = commandeClientService.findAllByBoutiqueId(boutiqueId);
        return commandes.stream().filter(c -> c.getTotal() != null && (c.getPaie() == null || c.getPaie().intValue() < c.getTotal().intValue())).map(c -> new PendingOrderDTO(c.getId(), c.getReference(), c.getTotal(), c.getClient()!=null?c.getClient().getNom():null, c.getDateCommande())).collect(Collectors.toList());
    }

    @GetMapping("/shop/{id}/staff-activity")
    @PreAuthorize("hasAnyRole('SUPERADMIN','PROPRIETAIRE','ADMINISTRATEUR','MANAGER')")
    public List<StaffActivityDTO> shopStaffActivity(@PathVariable("id") Long boutiqueId) {
        List<Utilisateur> users = utilisateurService.findAllByBoutiqueId(boutiqueId);
        LocalDateTime start = LocalDate.now().atStartOfDay();
        LocalDateTime end = LocalDateTime.now();
        List<StaffActivityDTO> out = new ArrayList<>();
        for (Utilisateur u : users) {
            long sales = 0L;
            List<CommandeClient> cmds = commandeClientService.findAllByBoutiqueId(boutiqueId);
            for (CommandeClient c : cmds) {
                if (c.getUtilisateur()!=null && u.getId().equals(c.getUtilisateur().getId()) && c.getDateCommande()!=null && !c.getDateCommande().isBefore(start) && !c.getDateCommande().isAfter(end)) {
                    sales += (c.getTotal()==null?0:c.getTotal());
                }
            }
            out.add(new StaffActivityDTO(u.getId(), u.getNom(), sales, "ON_SHIFT"));
        }
        return out;
    }

    // DTOs
    public static class ShopOverviewDTO {
        public Long salesTotal;
        public List<Long> sales7d;
        public Long pendingOrders;
        public List<TopProduct> topProducts;
    }

    public static class TopProduct {
        public Long id;
        public String name;
        public Long sold;
        public TopProduct(Long id, String name, Long sold) { this.id = id; this.name = name; this.sold = sold; }
    }

    public static class ProductAgg { public Long id; public String name; public Long sold; public ProductAgg(Long id,String name,Long sold){this.id=id;this.name=name;this.sold=sold;} }

    public static class PendingOrderDTO { public Long id; public String reference; public Integer total; public String clientName; public LocalDateTime dateCommande; public PendingOrderDTO(Long id,String ref,Integer total,String clientName,LocalDateTime dateCommande){this.id=id;this.reference=ref;this.total=total;this.clientName=clientName;this.dateCommande=dateCommande;} }

    public static class StaffActivityDTO { public Long userId; public String name; public Long salesToday; public String shiftStatus; public StaffActivityDTO(Long userId,String name,Long salesToday,String shiftStatus){this.userId=userId;this.name=name;this.salesToday=salesToday;this.shiftStatus=shiftStatus;} }
}
