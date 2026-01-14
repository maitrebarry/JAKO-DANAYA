package com.smboutique.api.controller;

import com.smboutique.api.dto.TopProductDTO;
import com.smboutique.api.dto.ValeurStockDTO;
import com.smboutique.api.dto.VenteJournalierDTO;
import com.smboutique.api.dto.StockReportItemDTO;
import com.smboutique.api.service.RapportService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/rapports")
@CrossOrigin(origins = "*")
public class RapportsController {

    @Autowired
    private RapportService rapportService;

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.service.PdfService pdfService;

    // Ventes journalières
    @GetMapping("/ventes")
    @PreAuthorize("hasAnyRole(T(com.smboutique.api.security.RoleConstants).SUPERADMIN, T(com.smboutique.api.security.RoleConstants).ADMINISTRATEUR, T(com.smboutique.api.security.RoleConstants).PROPRIETAIRE, T(com.smboutique.api.security.RoleConstants).ADMIN) or hasAuthority(T(com.smboutique.api.security.PermissionConstants).RAPPORTS_VOIR) or hasAuthority(T(com.smboutique.api.security.PermissionConstants).RAPPORT_LECTURE)")
    public Object ventes(
            @RequestParam(required = false) Long boutique,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String format,
            jakarta.servlet.http.HttpServletResponse response
    ) throws java.io.IOException {
        // Determine default boutique scope based on user (same approach as DocumentController)
        try {
            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            com.smboutique.api.model.Utilisateur currentUser = null;
            if (auth != null && auth.getName() != null) {
                currentUser = utilisateurService.findByEmail(auth.getName()).orElse(null);
            }
            boolean isSuper = currentUser != null && currentUser.getRoles() != null && currentUser.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
            if (!isSuper) {
                Long userBoutiqueId = currentUser != null && currentUser.getBoutique() != null ? currentUser.getBoutique().getId() : null;
                if (boutique == null) {
                    boutique = userBoutiqueId;
                } else {
                    if (userBoutiqueId == null || !userBoutiqueId.equals(boutique)) {
                        response.sendError(403);
                        return null;
                    }
                }
            }
        } catch (Exception ignore) {
            if (boutique == null) { response.sendError(403); return null; }
        }

        LocalDate fromDate = (from == null) ? LocalDate.now().withDayOfMonth(1) : LocalDate.parse(from);
        LocalDate toDate = (to == null) ? LocalDate.now() : LocalDate.parse(to);

        if ("csv".equalsIgnoreCase(format)) {
            var data = rapportService.ventes(fromDate, toDate, boutique);
            response.setContentType("text/csv; charset=UTF-8");
            String filename = String.format("ventes_%s_%s.csv", fromDate.toString(), toDate.toString());
            response.setHeader("Content-Disposition", "attachment; filename=" + filename);
            try (java.io.PrintWriter pw = response.getWriter()) {
                pw.println("date;nombreVentes;montantTotal");
                for (var d : data) {
                    pw.printf("%s;%d;%d\n", d.getDate().toString(), d.getNombreVentes(), d.getMontantTotal());
                }
            }
            return null;
        } else if ("pdf".equalsIgnoreCase(format)) {
            pdfService.writeRapportVentesPdf("ventes_report_" + fromDate.toString() + "_" + toDate.toString() + ".pdf", fromDate, toDate, boutique, response);
            return null;
        }

        return ResponseEntity.ok(rapportService.ventes(fromDate, toDate, boutique));
    }

    // Stock actuel par boutique
    @GetMapping("/stock")
    @PreAuthorize("hasAnyRole(T(com.smboutique.api.security.RoleConstants).SUPERADMIN, T(com.smboutique.api.security.RoleConstants).ADMINISTRATEUR, T(com.smboutique.api.security.RoleConstants).PROPRIETAIRE, T(com.smboutique.api.security.RoleConstants).ADMIN) or hasAuthority(T(com.smboutique.api.security.PermissionConstants).RAPPORTS_VOIR) or hasAuthority(T(com.smboutique.api.security.PermissionConstants).RAPPORT_LECTURE)")
    public Object stock(
            @RequestParam(required = false) Long boutique,
            @RequestParam(required = false) String format,
            jakarta.servlet.http.HttpServletResponse response
    ) throws java.io.IOException {
        // Same scoping rules
        try {
            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            com.smboutique.api.model.Utilisateur currentUser = null;
            if (auth != null && auth.getName() != null) {
                currentUser = utilisateurService.findByEmail(auth.getName()).orElse(null);
            }
            boolean isSuper = currentUser != null && currentUser.getRoles() != null && currentUser.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
            if (!isSuper) {
                Long userBoutiqueId = currentUser != null && currentUser.getBoutique() != null ? currentUser.getBoutique().getId() : null;
                if (boutique == null) {
                    boutique = userBoutiqueId;
                } else {
                    if (userBoutiqueId == null || !userBoutiqueId.equals(boutique)) {
                        response.sendError(403);
                        return null;
                    }
                }
            }
        } catch (Exception ignore) {
            if (boutique == null) { response.sendError(403); return null; }
        }

        if ("csv".equalsIgnoreCase(format)) {
            var data = rapportService.stock(boutique);
            response.setContentType("text/csv; charset=UTF-8");
            String filename = String.format("stock_boutique_%s.csv", boutique != null ? boutique.toString() : "all");
            response.setHeader("Content-Disposition", "attachment; filename=" + filename);
            try (java.io.PrintWriter pw = response.getWriter()) {
                pw.println("stockId;produitId;produit;quantiteDisponible;costAverage;lastPurchasePrice;magasinId;magasinName");
                for (var d : data) {
                    pw.printf("%s;%s;%s;%s;%s;%s;%s;%s\n",
                            d.getStockId() != null ? d.getStockId().toString() : "",
                            d.getProduitId() != null ? d.getProduitId().toString() : "",
                            d.getProduitName() != null ? d.getProduitName().replaceAll("[\n\r;]"," ") : "",
                            d.getQuantiteDisponible() != null ? d.getQuantiteDisponible().toString() : "",
                            d.getCostAverage() != null ? d.getCostAverage().toString() : "",
                            d.getLastPurchasePrice() != null ? d.getLastPurchasePrice().toString() : "",
                            d.getMagasinId() != null ? d.getMagasinId().toString() : "",
                            d.getMagasinName() != null ? d.getMagasinName().replaceAll("[\n\r;]"," ") : "");
                }
            }
            return null;
        } else if ("pdf".equalsIgnoreCase(format)) {
            pdfService.writeRapportStockPdf("stock_report_" + (boutique != null ? boutique.toString() : "all") + ".pdf", boutique, response);
            return null;
        }

        return ResponseEntity.ok(rapportService.stock(boutique));
    }

    // Valeur du stock
    @GetMapping("/valeur-stock")
    @PreAuthorize("hasAnyRole(T(com.smboutique.api.security.RoleConstants).SUPERADMIN, T(com.smboutique.api.security.RoleConstants).ADMINISTRATEUR, T(com.smboutique.api.security.RoleConstants).PROPRIETAIRE, T(com.smboutique.api.security.RoleConstants).ADMIN) or hasAuthority(T(com.smboutique.api.security.PermissionConstants).RAPPORTS_VOIR) or hasAuthority(T(com.smboutique.api.security.PermissionConstants).RAPPORT_LECTURE)")
    public Object valeurStock(
            @RequestParam(required = false) Long boutique,
            @RequestParam(required = false) String format,
            jakarta.servlet.http.HttpServletResponse response
    ) throws java.io.IOException {
        try {
            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            com.smboutique.api.model.Utilisateur currentUser = null;
            if (auth != null && auth.getName() != null) {
                currentUser = utilisateurService.findByEmail(auth.getName()).orElse(null);
            }
            boolean isSuper = currentUser != null && currentUser.getRoles() != null && currentUser.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
            if (!isSuper) {
                Long userBoutiqueId = currentUser != null && currentUser.getBoutique() != null ? currentUser.getBoutique().getId() : null;
                if (boutique == null) {
                    boutique = userBoutiqueId;
                } else {
                    if (userBoutiqueId == null || !userBoutiqueId.equals(boutique)) {
                        response.sendError(403);
                        return null;
                    }
                }
            }
        } catch (Exception ignore) {
            if (boutique == null) { response.sendError(403); return null; }
        }

        if ("csv".equalsIgnoreCase(format)) {
            var data = rapportService.valeurStock(boutique);
            response.setContentType("text/csv; charset=UTF-8");
            String filename = String.format("valeur_stock_boutique_%s.csv", boutique != null ? boutique.toString() : "all");
            response.setHeader("Content-Disposition", "attachment; filename=" + filename);
            try (java.io.PrintWriter pw = response.getWriter()) {
                pw.println("produitId;produit;quantite;unitPrice;lineValue");
                for (var d : data.getDetails()) {
                    java.math.BigDecimal unitPrice = d.getCostAverage() != null ? d.getCostAverage() : (d.getLastPurchasePrice() != null ? d.getLastPurchasePrice() : java.math.BigDecimal.ZERO);
                    java.math.BigDecimal lineVal = unitPrice.multiply(java.math.BigDecimal.valueOf(d.getQuantiteDisponible() != null ? d.getQuantiteDisponible() : 0));
                    pw.printf("%s;%s;%s;%s;%s\n",
                            d.getProduitId() != null ? d.getProduitId().toString() : "",
                            d.getProduitName() != null ? d.getProduitName().replaceAll("[\n\r;]"," ") : "",
                            d.getQuantiteDisponible() != null ? d.getQuantiteDisponible().toString() : "",
                            unitPrice.toString(),
                            lineVal.toString());
                }
            }
            return null;
        } else if ("pdf".equalsIgnoreCase(format)) {
            pdfService.writeRapportValeurStockPdf("valeur_stock_report_" + (boutique != null ? boutique.toString() : "all") + ".pdf", boutique, response);
            return null;
        }

        return ResponseEntity.ok(rapportService.valeurStock(boutique));
    }

    // Produits les plus vendus
    @GetMapping("/top-produits")
    @PreAuthorize("hasAnyRole(T(com.smboutique.api.security.RoleConstants).SUPERADMIN, T(com.smboutique.api.security.RoleConstants).ADMINISTRATEUR, T(com.smboutique.api.security.RoleConstants).PROPRIETAIRE, T(com.smboutique.api.security.RoleConstants).ADMIN) or hasAuthority(T(com.smboutique.api.security.PermissionConstants).RAPPORTS_VOIR) or hasAuthority(T(com.smboutique.api.security.PermissionConstants).RAPPORT_LECTURE)")
    public Object topProduits(
            @RequestParam(required = false) Long boutique,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false, defaultValue = "10") int limit,
            @RequestParam(required = false) String format,
            jakarta.servlet.http.HttpServletResponse response
    ) throws java.io.IOException {
        try {
            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            com.smboutique.api.model.Utilisateur currentUser = null;
            if (auth != null && auth.getName() != null) {
                currentUser = utilisateurService.findByEmail(auth.getName()).orElse(null);
            }
            boolean isSuper = currentUser != null && currentUser.getRoles() != null && currentUser.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
            if (!isSuper) {
                Long userBoutiqueId = currentUser != null && currentUser.getBoutique() != null ? currentUser.getBoutique().getId() : null;
                if (boutique == null) {
                    boutique = userBoutiqueId;
                } else {
                    if (userBoutiqueId == null || !userBoutiqueId.equals(boutique)) {
                        response.sendError(403);
                        return null;
                    }
                }
            }
        } catch (Exception ignore) {
            if (boutique == null) { response.sendError(403); return null; }
        }

        LocalDate fromDate = (from == null) ? LocalDate.now().withDayOfMonth(1) : LocalDate.parse(from);
        LocalDate toDate = (to == null) ? LocalDate.now() : LocalDate.parse(to);

        if ("csv".equalsIgnoreCase(format)) {
            var data = rapportService.topProduits(fromDate, toDate, boutique, limit);
            response.setContentType("text/csv; charset=UTF-8");
            String filename = String.format("top_produits_%s_%s.csv", fromDate.toString(), toDate.toString());
            response.setHeader("Content-Disposition", "attachment; filename=" + filename);
            try (java.io.PrintWriter pw = response.getWriter()) {
                pw.println("produitId;produitName;quantiteVendue;montantTotal");
                for (var d : data) {
                    pw.printf("%s;%s;%d;%d\n",
                            d.getProduitId() != null ? d.getProduitId().toString() : "",
                            d.getProduitName() != null ? d.getProduitName().replaceAll("[\n\r;]"," ") : "",
                            d.getQuantiteVendue(),
                            d.getMontantTotal());
                }
            }
            return null;
        } else if ("pdf".equalsIgnoreCase(format)) {
            pdfService.writeRapportTopProduitsPdf("top_produits_report_" + fromDate.toString() + "_" + toDate.toString() + ".pdf", fromDate, toDate, boutique, limit, response);
            return null;
        }

        return ResponseEntity.ok(rapportService.topProduits(fromDate, toDate, boutique, limit));
    }
}