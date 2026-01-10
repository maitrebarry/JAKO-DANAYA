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
    public com.smboutique.api.service.dto.DashboardPayload dashboard(@RequestParam(value = "shopId", required = false) Long shopId) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        com.smboutique.api.service.dto.DashboardPayload p = new com.smboutique.api.service.dto.DashboardPayload();
        if (authentication == null || authentication.getName() == null) {
            p.role = "UNAUTHENTICATED";
            p.widgets = Map.of("error", "Authentification requise");
            return p;
        }
        String email = authentication.getName();
        Utilisateur utilisateur = utilisateurService.findByEmail(email).orElse(null);
        if (utilisateur == null) {
            p.role = "UNAUTHENTICATED";
            p.widgets = Map.of("error", "Utilisateur non trouvé");
            return p;
        }

        // Delegate to service which implements role-based filtering
        com.smboutique.api.service.dto.DashboardPayload payload = dashboardService.getDashboardFor(utilisateur, shopId);

        // For superadmin, fill counts that require repositories (kept in controller for clarity)
        if ("SUPERADMIN".equalsIgnoreCase(payload.role)) {
            if (payload.widgets != null) {
                payload.widgets.put("shopsCount", boutiqueRepository.count());
                payload.widgets.put("usersCount", utilisateurService.findAll().size());
                payload.widgets.put("transactionsCount", commandeClientService.findAll().size());
            }
        }

        return payload;


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

    @GetMapping("/subordinates")
    @PreAuthorize("hasAnyRole('SUPERADMIN','PROPRIETAIRE','ADMINISTRATEUR')")
    public List<Map<String,Object>> subordinates() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) return java.util.Collections.emptyList();
        String email = authentication.getName();
        Utilisateur current = utilisateurService.findByEmail(email).orElse(null);
        if (current == null || current.getBoutique() == null) return java.util.Collections.emptyList();
        Long boutiqueId = current.getBoutique().getId();

        List<Utilisateur> users = utilisateurService.findAllByBoutiqueId(boutiqueId);
        if (users == null || users.isEmpty()) return java.util.Collections.emptyList();

        List<Map<String,Object>> out = new ArrayList<>();
        for (Utilisateur u : users) {
            if (u.getId().equals(current.getId())) continue; // skip self
            String t = u.getTypeUtilisateur()!=null ? u.getTypeUtilisateur().toUpperCase() : null;
            // only include subordinate roles
            if (!("GERANT_BOUTIQUE".equalsIgnoreCase(t) || "CAISSIER".equalsIgnoreCase(t) || "MAGASINIER".equalsIgnoreCase(t))) continue;

            com.smboutique.api.service.dto.DashboardPayload p = dashboardService.getDashboardFor(u, boutiqueId);
            java.util.List<java.util.Map<String,Object>> widgetList = new java.util.ArrayList<>();
            if (p != null && p.widgets != null) {
                p.widgets.forEach((k,v) -> {
                    java.util.Map<String,Object> wm = new java.util.HashMap<>();
                    wm.put("key", k);
                    wm.put("data", java.util.Map.of("value", v));
                    widgetList.add(wm);
                });
            }

            java.util.Map<String,Object> entry = new java.util.HashMap<>();
            entry.put("role", p!=null? p.role : t);
            entry.put("name", u.getNom());
            entry.put("shopName", current.getBoutique()!=null? current.getBoutique().getNom():null);
            entry.put("widgets", widgetList);
            out.add(entry);
        }
        return out;
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
