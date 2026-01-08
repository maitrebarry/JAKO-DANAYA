package com.smboutique.api.controller;

import com.smboutique.api.model.DocumentReference;
import com.smboutique.api.repository.VenteRepository;
import com.smboutique.api.repository.ReceptionRepository;
import com.smboutique.api.repository.InventaireRepository;
import com.smboutique.api.repository.CaisseTransactionRepository;
import com.smboutique.api.service.PdfService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/documents")
@CrossOrigin(origins = "*")
public class DocumentController {

    @Autowired
    private VenteRepository venteRepository;

    @Autowired
    private ReceptionRepository receptionRepository;

    @Autowired
    private InventaireRepository inventaireRepository;

    @Autowired
    private CaisseTransactionRepository caisseTransactionRepository;

    @Autowired
    private com.smboutique.api.service.MouvementService mouvementService;

    @Autowired
    private com.smboutique.api.service.UtilisateurService utilisateurService;

    @Autowired
    private PdfService pdfService;

    @Autowired
    private com.smboutique.api.repository.CommandeFournisseurRepository commandeFournisseurRepository;

    @Autowired
    private com.smboutique.api.repository.CommandeClientRepository commandeClientRepository;

    // Aggregated list of available document references (no persisted Document entity)
    @GetMapping
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE') or hasAuthority('DOCUMENTS_VOIR')")
    public ResponseEntity<Page<DocumentReference>> listDocuments(
            @RequestParam(required = false) Long boutique,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String ref,
            Pageable pageable
    ) {
        List<DocumentReference> list = new ArrayList<>();

        // Ventes
        // intentionally kept simple: use reference fields available on Vente
        var ventes = (boutique == null) ? venteRepository.findAll() : venteRepository.findByBoutiqueId(boutique);
        for (var v : ventes) {
            DocumentReference dr = new DocumentReference();
            dr.setSourceType("VENTE");
            dr.setSourceId(v.getId());
            dr.setReference(v.getReferenceCaisse() != null ? v.getReferenceCaisse() : null);
            dr.setDate(v.getDateVente());
            dr.setPreviewUrl("/api/documents/vente/" + v.getId() + "/preview?format=pdf");
            dr.setDownloadUrl("/api/documents/vente/" + v.getId() + "/download?format=pdf");
            list.add(dr);
        }
        // Receptions
        var receptions = (boutique == null) ? receptionRepository.findAll() : receptionRepository.findByBoutiqueId(boutique);
        for (var r : receptions) {
            DocumentReference dr = new DocumentReference();
            dr.setSourceType("RECEPTION");
            dr.setSourceId(r.getId());
            dr.setReference(r.getReference());
            dr.setDate(r.getDateReception());
            dr.setPreviewUrl("/api/documents/reception/" + r.getId() + "/preview?format=pdf");
            dr.setDownloadUrl("/api/documents/reception/" + r.getId() + "/download?format=pdf");
            list.add(dr);
        }

        // Commandes fournisseurs
        var cmdsF = (boutique == null) ? commandeFournisseurRepository.findAll() : commandeFournisseurRepository.findAllByBoutiqueId(boutique);
        for (var cf : cmdsF) {
            DocumentReference dr = new DocumentReference();
            dr.setSourceType("COMMANDE_FOURNISSEUR");
            dr.setSourceId(cf.getId());
            dr.setReference(cf.getReference());
            dr.setDate(cf.getDateCommande());
            dr.setPreviewUrl("/api/documents/commande-fournisseur/" + cf.getId() + "/preview?format=pdf");
            dr.setDownloadUrl("/api/documents/commande-fournisseur/" + cf.getId() + "/download?format=pdf");
            list.add(dr);
        }

        // Commandes clients (ventes/commandes-clients)
        var cmdsC = (boutique == null) ? commandeClientRepository.findAll() : commandeClientRepository.findAllByBoutiqueId(boutique);
        for (var cc : cmdsC) {
            DocumentReference dr = new DocumentReference();
            dr.setSourceType("COMMANDE_CLIENT");
            dr.setSourceId(cc.getId());
            dr.setReference(cc.getReference());
            dr.setDate(cc.getDateCommande());
            dr.setPreviewUrl("/api/documents/commande-client/" + cc.getId() + "/preview?format=pdf");
            dr.setDownloadUrl("/api/documents/commande-client/" + cc.getId() + "/download?format=pdf");
            list.add(dr);
        }

        // Inventaires
        var invs = (boutique == null) ? inventaireRepository.findAll() : inventaireRepository.findByBoutiqueId(boutique);
        for (var inv : invs) {
            DocumentReference dr = new DocumentReference();
            dr.setSourceType("INVENTAIRE");
            dr.setSourceId(inv.getId());
            dr.setReference(inv.getReference());
            dr.setDate(inv.getDateInventaire());
            dr.setPreviewUrl("/api/documents/inventaire/" + inv.getId() + "/preview?format=pdf");
            dr.setDownloadUrl("/api/documents/inventaire/" + inv.getId() + "/download?format=pdf");
            list.add(dr);
        }

        // Caisse transactions (receipts)
        var cts = (boutique == null) ? caisseTransactionRepository.findAll() : caisseTransactionRepository.findByBoutiqueId(boutique);
        for (var ct : cts) {
            DocumentReference dr = new DocumentReference();
            dr.setSourceType("CAISSE");
            dr.setSourceId(ct.getId());
            dr.setReference(ct.getReferenceCaisse());
            dr.setDate(ct.getCreatedAt());
            dr.setPreviewUrl("/api/documents/caisse/" + ct.getId() + "/preview?format=pdf");
            dr.setDownloadUrl("/api/documents/caisse/" + ct.getId() + "/download?format=pdf");
            list.add(dr);
        }

        // Apply filter by type/ref if provided
        List<DocumentReference> filtered = list.stream()
                .filter(d -> type == null || d.getSourceType().equalsIgnoreCase(type))
                .filter(d -> ref == null || (d.getReference() != null && d.getReference().toLowerCase().contains(ref.toLowerCase())))
                .collect(Collectors.toList());

        int start = (int) pageable.getOffset();
        int end = Math.min((start + pageable.getPageSize()), filtered.size());
        List<DocumentReference> pageContent = (start <= end) ? filtered.subList(start, end) : List.of();

        Page<DocumentReference> page = new PageImpl<>(pageContent, pageable, filtered.size());
        return ResponseEntity.ok(page);
    }

    // Generate and stream PDF for a given reference type/id
    @GetMapping("/{type}/{id}/preview")
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE') or hasAuthority('DOCUMENTS_VOIR')")
    public void preview(@PathVariable String type, @PathVariable Long id, @RequestParam(defaultValue = "pdf") String format, HttpServletResponse response) throws IOException {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        if (!"pdf".equalsIgnoreCase(format)) { response.sendError(400); return; }
        switch (type.toLowerCase()) {
            case "vente":
                pdfService.writeVentePdf(id, response);
                try {
                    Long userId = null;
                    try {
                        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                        if (auth != null && auth.getName() != null) {
                            var u = utilisateurService.findByEmail(auth.getName()).orElse(null);
                            if (u != null) userId = u.getId();
                        }
                    } catch (Exception ignore) {}
                    var vopt = venteRepository.findById(id);
                    if (vopt.isPresent()) {
                        var v = vopt.get();
                        Long boutiqueId = v.getBoutique() != null ? v.getBoutique().getId() : null;
                        Double montant = v.getMontantTotal() != null ? Double.valueOf(v.getMontantTotal()) : null;
                        mouvementService.log("DOCUMENT", "VENTE_PDF_PREVIEW", "Aperçu PDF - VENTE", id, boutiqueId, null, userId, montant);
                    }
                } catch (Exception ignore) {}
                return;
            case "reception":
                pdfService.writeReceptionPdf(id, response);
                try {
                    Long userId = null;
                    try {
                        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                        if (auth != null && auth.getName() != null) {
                            var u = utilisateurService.findByEmail(auth.getName()).orElse(null);
                            if (u != null) userId = u.getId();
                        }
                    } catch (Exception ignore) {}
                    var ropt = receptionRepository.findById(id);
                    if (ropt.isPresent()) {
                        var r = ropt.get();
                        Long boutiqueId = r.getBoutique() != null ? r.getBoutique().getId() : null;
                        mouvementService.log("DOCUMENT", "RECEPTION_PDF_PREVIEW", "Aperçu PDF - RECEPTION", id, boutiqueId, null, userId, null);
                    }
                } catch (Exception ignore) {}
                return;
            case "inventaire":
                pdfService.writeInventairePdf(id, response);
                try {
                    Long userId = null;
                    try {
                        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                        if (auth != null && auth.getName() != null) {
                            var u = utilisateurService.findByEmail(auth.getName()).orElse(null);
                            if (u != null) userId = u.getId();
                        }
                    } catch (Exception ignore) {}
                    var iopt = inventaireRepository.findById(id);
                    if (iopt.isPresent()) {
                        var inv = iopt.get();
                        Long boutiqueId = inv.getBoutique() != null ? inv.getBoutique().getId() : null;
                        mouvementService.log("DOCUMENT", "INVENTAIRE_PDF_PREVIEW", "Aperçu PDF - INVENTAIRE", id, boutiqueId, null, userId, null);
                    }
                } catch (Exception ignore) {}
                return;
            case "commande-fournisseur":
                // Use existing command PDF writer
                pdfService.writeCommandePdf(id, response);
                try {
                    Long userId = null;
                    try {
                        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                        if (auth != null && auth.getName() != null) {
                            var u = utilisateurService.findByEmail(auth.getName()).orElse(null);
                            if (u != null) userId = u.getId();
                        }
                    } catch (Exception ignore) {}
                    var copt = commandeFournisseurRepository.findById(id);
                    if (copt.isPresent()) {
                        var c = copt.get();
                        Long boutiqueId = c.getBoutique() != null ? c.getBoutique().getId() : null;
                        mouvementService.log("DOCUMENT", "COMMANDE_FOURNISSEUR_PDF_PREVIEW", "Aperçu PDF - COMMANDE FOURNISSEUR", id, boutiqueId, null, userId, null);
                    }
                } catch (Exception ignore) {}
                return;
            case "commande-client":
                pdfService.writeCommandeClientPdf(id, response);
                try {
                    Long userId = null;
                    try {
                        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                        if (auth != null && auth.getName() != null) {
                            var u = utilisateurService.findByEmail(auth.getName()).orElse(null);
                            if (u != null) userId = u.getId();
                        }
                    } catch (Exception ignore) {}
                    var copt = commandeClientRepository.findById(id);
                    if (copt.isPresent()) {
                        var c = copt.get();
                        Long boutiqueId = c.getBoutique() != null ? c.getBoutique().getId() : null;
                        mouvementService.log("DOCUMENT", "COMMANDE_CLIENT_PDF_PREVIEW", "Aperçu PDF - COMMANDE CLIENT", id, boutiqueId, null, userId, null);
                    }
                } catch (Exception ignore) {}
                return;
            case "caisse":
                var txopt = caisseTransactionRepository.findById(id);
                if (txopt.isEmpty()) { response.sendError(404); return; }
                var tx = txopt.get();
                if (tx.getPaiementId() != null) {
                    pdfService.writePaiementPdf(tx.getPaiementId(), response);
                    try {
                        Long userId = null;
                        try {
                            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                            if (auth != null && auth.getName() != null) {
                                var u = utilisateurService.findByEmail(auth.getName()).orElse(null);
                                if (u != null) userId = u.getId();
                            }
                        } catch (Exception ignore) {}
                        mouvementService.log("DOCUMENT", "CAISSE_PDF_PREVIEW", "Aperçu PDF - CAISSE (paiement)", id, tx.getBoutiqueId(), null, userId, tx.getMontant() != null ? Double.valueOf(tx.getMontant()) : null);
                    } catch (Exception ignore) {}
                    return;
                } else {
                    // Generate a generic caisse transaction receipt when no paiement is linked
                    pdfService.writeCaisseTransactionPdf(id, response);
                    try {
                        Long userId = null;
                        try {
                            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                            if (auth != null && auth.getName() != null) {
                                var u = utilisateurService.findByEmail(auth.getName()).orElse(null);
                                if (u != null) userId = u.getId();
                            }
                        } catch (Exception ignore) {}
                        mouvementService.log("DOCUMENT", "CAISSE_PDF_PREVIEW", "Aperçu PDF - CAISSE (transaction)", id, tx.getBoutiqueId(), null, userId, tx.getMontant() != null ? Double.valueOf(tx.getMontant()) : null);
                    } catch (Exception ignore) {}
                    return;
                }
            default:
                response.sendError(404);
        }
    }

    @GetMapping("/{type}/{id}/download")
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMINISTRATEUR','PROPRIETAIRE') or hasAuthority('DOCUMENTS_TELECHARGER')")
    public void download(@PathVariable String type, @PathVariable Long id, @RequestParam(defaultValue = "pdf") String format, HttpServletResponse response) throws IOException {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        if ("pdf".equalsIgnoreCase(format)) {
            switch (type.toLowerCase()) {
                case "vente":
                    pdfService.writeVentePdf(id, response);
                    // audit
                    try {
                        Long userId = null;
                        try {
                            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                            if (auth != null && auth.getName() != null) {
                                var u = utilisateurService.findByEmail(auth.getName()).orElse(null);
                                if (u != null) userId = u.getId();
                            }
                        } catch (Exception ignore) {}
                        var vopt = venteRepository.findById(id);
                        if (vopt.isPresent()) {
                            var v = vopt.get();
                            Long boutiqueId = v.getBoutique() != null ? v.getBoutique().getId() : null;
                            Double montant = v.getMontantTotal() != null ? Double.valueOf(v.getMontantTotal()) : null;
                            mouvementService.log("DOCUMENT", "VENTE_PDF", "Génération PDF - VENTE", id, boutiqueId, null, userId, montant);
                        }
                    } catch (Exception ignore) {}
                    return;
                case "reception":
                    pdfService.writeReceptionPdf(id, response);
                    try {
                        Long userId = null;
                        try {
                            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                            if (auth != null && auth.getName() != null) {
                                var u = utilisateurService.findByEmail(auth.getName()).orElse(null);
                                if (u != null) userId = u.getId();
                            }
                        } catch (Exception ignore) {}
                        var ropt = receptionRepository.findById(id);
                        if (ropt.isPresent()) {
                            var r = ropt.get();
                            Long boutiqueId = r.getBoutique() != null ? r.getBoutique().getId() : null;
                            mouvementService.log("DOCUMENT", "RECEPTION_PDF", "Génération PDF - RECEPTION", id, boutiqueId, null, userId, null);
                        }
                    } catch (Exception ignore) {}
                    return;
                case "inventaire":
                    pdfService.writeInventairePdf(id, response);
                    try {
                        Long userId = null;
                        try {
                            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                            if (auth != null && auth.getName() != null) {
                                var u = utilisateurService.findByEmail(auth.getName()).orElse(null);
                                if (u != null) userId = u.getId();
                            }
                        } catch (Exception ignore) {}
                        var iopt = inventaireRepository.findById(id);
                        if (iopt.isPresent()) {
                            var inv = iopt.get();
                            Long boutiqueId = inv.getBoutique() != null ? inv.getBoutique().getId() : null;
                            mouvementService.log("DOCUMENT", "INVENTAIRE_PDF", "Génération PDF - INVENTAIRE", id, boutiqueId, null, userId, null);
                        }
                    } catch (Exception ignore) {}
                    return;
                case "commande-fournisseur":
                    pdfService.writeCommandePdf(id, response);
                    try {
                        Long userId = null;
                        try {
                            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                            if (auth != null && auth.getName() != null) {
                                var u = utilisateurService.findByEmail(auth.getName()).orElse(null);
                                if (u != null) userId = u.getId();
                            }
                        } catch (Exception ignore) {}
                        var copt = commandeFournisseurRepository.findById(id);
                        if (copt.isPresent()) {
                            var c = copt.get();
                            Long boutiqueId = c.getBoutique() != null ? c.getBoutique().getId() : null;
                            mouvementService.log("DOCUMENT", "COMMANDE_FOURNISSEUR_PDF", "Génération PDF - COMMANDE FOURNISSEUR", id, boutiqueId, null, userId, null);
                        }
                    } catch (Exception ignore) {}
                    return;
                case "commande-client":
                    pdfService.writeCommandeClientPdf(id, response);
                    try {
                        Long userId = null;
                        try {
                            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                            if (auth != null && auth.getName() != null) {
                                var u = utilisateurService.findByEmail(auth.getName()).orElse(null);
                                if (u != null) userId = u.getId();
                            }
                        } catch (Exception ignore) {}
                        var copt = commandeClientRepository.findById(id);
                        if (copt.isPresent()) {
                            var c = copt.get();
                            Long boutiqueId = c.getBoutique() != null ? c.getBoutique().getId() : null;
                            mouvementService.log("DOCUMENT", "COMMANDE_CLIENT_PDF", "Génération PDF - COMMANDE CLIENT", id, boutiqueId, null, userId, null);
                        }
                    } catch (Exception ignore) {}
                    return;
                case "caisse":
                    var txopt = caisseTransactionRepository.findById(id);
                    if (txopt.isEmpty()) { response.sendError(404); return; }
                    var tx = txopt.get();
                    if (tx.getPaiementId() != null) {
                        pdfService.writePaiementPdf(tx.getPaiementId(), response);
                        try {
                            Long userId = null;
                            try {
                                var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                                if (auth != null && auth.getName() != null) {
                                    var u = utilisateurService.findByEmail(auth.getName()).orElse(null);
                                    if (u != null) userId = u.getId();
                                }
                            } catch (Exception ignore) {}
                            mouvementService.log("DOCUMENT", "CAISSE_PDF", "Génération PDF - CAISSE (paiement)", id, tx.getBoutiqueId(), null, userId, tx.getMontant() != null ? Double.valueOf(tx.getMontant()) : null);
                        } catch (Exception ignore) {}
                        return;
                    } else {
                        // Generate a generic caisse receipt when no associated payment exists
                        pdfService.writeCaisseTransactionPdf(id, response);
                        try {
                            Long userId = null;
                            try {
                                var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                                if (auth != null && auth.getName() != null) {
                                    var u = utilisateurService.findByEmail(auth.getName()).orElse(null);
                                    if (u != null) userId = u.getId();
                                }
                            } catch (Exception ignore) {}
                            mouvementService.log("DOCUMENT", "CAISSE_PDF", "Génération PDF - CAISSE (transaction)", id, tx.getBoutiqueId(), null, userId, tx.getMontant() != null ? Double.valueOf(tx.getMontant()) : null);
                        } catch (Exception ignore) {}
                        return;
                    }
                default:
                    response.sendError(404);
            }
        } else if ("csv".equalsIgnoreCase(format)) {
            // Simple CSV generation for the referenced resource
            response.setContentType("text/csv");
            response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"document-" + type + "-" + id + ".csv\"");

            switch (type.toLowerCase()) {
                case "vente":
                    var vente = venteRepository.findById(id);
                    if (vente.isEmpty()) { response.sendError(404); return; }
                    var v = vente.get();
                    var sb = new StringBuilder();
                    sb.append("reference,date,montantTotal\n");
                    sb.append((v.getReferenceCaisse()!=null? v.getReferenceCaisse():"")).append(",").append(v.getDateVente()).append(",").append(v.getMontantTotal()).append("\n");
                    response.getWriter().write(sb.toString());
                    // audit CSV generation
                    try {
                        Long userId = null;
                        try {
                            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                            if (auth != null && auth.getName() != null) {
                                var u = utilisateurService.findByEmail(auth.getName()).orElse(null);
                                if (u != null) userId = u.getId();
                            }
                        } catch (Exception ignore) {}
                        mouvementService.log("DOCUMENT", "VENTE_CSV", "Génération CSV - VENTE", id, v.getBoutique() != null ? v.getBoutique().getId() : null, null, userId, v.getMontantTotal() != null ? Double.valueOf(v.getMontantTotal()) : null);
                    } catch (Exception ignore) {}
                    return;
                default:
                    response.sendError(404);
            }
        } else {
            response.sendError(400);
        }
    }
}
