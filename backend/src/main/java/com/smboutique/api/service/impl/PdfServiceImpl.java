package com.smboutique.api.service.impl;

import com.smboutique.api.model.CommandeFournisseur;
import com.smboutique.api.service.CommandeFournisseurService;
import com.smboutique.api.service.PdfService;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

@Service
public class PdfServiceImpl implements PdfService {

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(PdfServiceImpl.class);

    @Autowired
    private CommandeFournisseurService commandeFournisseurService;

    @Autowired
    private com.smboutique.api.service.CommandeClientService commandeClientService;

    @Autowired
    private com.smboutique.api.service.ReceptionService receptionService;

    @Autowired
    private com.smboutique.api.service.PaiementService paiementService;

    @Autowired
    private com.smboutique.api.service.LigneReceptionService ligneReceptionService;

    @Autowired
    private com.smboutique.api.service.PaiementClientService paiementClientService;

    @Autowired
    private com.smboutique.api.service.LivraisonService livraisonService;

    @Autowired
    private com.smboutique.api.service.LigneLivraisonService ligneLivraisonService;

    // Services used for vente PDF
    @Autowired
    private com.smboutique.api.service.VenteService venteService;

    @Autowired
    private com.smboutique.api.service.LigneVenteService ligneVenteService;

    @Autowired
    private com.smboutique.api.service.DepenseService depenseService;

    @Autowired
    private com.smboutique.api.repository.ProduitRepository produitRepository;

    @Autowired
    private com.smboutique.api.repository.BoutiqueRepository boutiqueRepository;

    @Autowired
    private com.smboutique.api.service.UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.repository.InventaireRepository inventaireRepository;

    @Autowired
    private com.smboutique.api.repository.LigneInventaireRepository ligneInventaireRepository;

    @Autowired
    private com.smboutique.api.repository.CaisseTransactionRepository caisseTransactionRepository;

    // Rapport service used to obtain report data for PDFs
    @Autowired
    private com.smboutique.api.service.RapportService rapportService;

    /** Lit un fichier image de branding (logo/cachet/signature) et renvoie un data URI base64, ou null. */
    private String brandingDataUri(String path) {
        try {
            if (path == null || path.isBlank()) return null;
            String p = path.startsWith("/") ? path.substring(1) : path;
            java.io.File f = new java.io.File(p);
            if (!f.exists()) return null;
            byte[] bytes = java.nio.file.Files.readAllBytes(f.toPath());
            String base64 = java.util.Base64.getEncoder().encodeToString(bytes);
            String lower = p.toLowerCase();
            String mime = (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) ? "image/jpeg"
                    : lower.endsWith(".gif") ? "image/gif"
                    : lower.endsWith(".webp") ? "image/webp"
                    : "image/png";
            return "data:" + mime + ";base64," + base64;
        } catch (Exception e) {
            return null;
        }
    }

    /** Expose cachet + signature de la boutique aux templates (bas de page). Null-safe. */
    private void applyCachetSignature(Context ctx, com.smboutique.api.model.Boutique b) {
        ctx.setVariable("cachetBase64", b != null ? brandingDataUri(b.getCachet()) : null);
        ctx.setVariable("signatureBase64", b != null ? brandingDataUri(b.getSignature()) : null);
    }

    @Override
    public void writeCommandePdf(Long commandeId, HttpServletResponse response) throws IOException {
        org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(PdfServiceImpl.class);
        String currentUser = "anonymous";
        try {
            if (org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication() != null) {
                Object p = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
                try { currentUser = p == null ? "anonymous" : (p instanceof java.security.Principal ? ((java.security.Principal)p).getName() : p.toString()); } catch (Exception e) {}
            }
        } catch (Exception e) {}
        log.info("writeCommandePdf start for id={} by {}", commandeId, currentUser);

        CommandeFournisseur commande = commandeFournisseurService.findById(commandeId).orElse(null);
        if (commande == null) {
            log.warn("writeCommandePdf: commande {} not found", commandeId);
            throw new RuntimeException("Commande fournisseur non trouvée");
        }

        // Ne pas définir les headers PDF avant d'être certain que la génération réussit

        try {
            // Build Thymeleaf context and render HTML to PDF using OpenHTMLToPDF
            ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
            templateResolver.setPrefix("/templates/");
            templateResolver.setSuffix(".html");
            templateResolver.setTemplateMode("HTML");
            templateResolver.setCharacterEncoding("UTF-8");
            TemplateEngine templateEngine = new TemplateEngine();
            templateEngine.setTemplateResolver(templateResolver);

            Context ctx = new Context();
            ctx.setVariable("commande", commande);
            String logoData = null;
            try {
                if (commande.getBoutique() != null && commande.getBoutique().getLogo() != null) {
                    String logoPath = commande.getBoutique().getLogo().startsWith("/") ? commande.getBoutique().getLogo().substring(1) : commande.getBoutique().getLogo();
                    java.io.File f = new java.io.File(logoPath);
                    if (f.exists()) {
                        byte[] b = java.nio.file.Files.readAllBytes(f.toPath());
                        String base64 = java.util.Base64.getEncoder().encodeToString(b);
                        logoData = "data:image/png;base64," + base64;
                    }
                }
            } catch (Exception ex) {
                // ignore
            }
            ctx.setVariable("logoBase64", logoData);
            applyCachetSignature(ctx, commande.getBoutique());

            // Build a normalized representation of lines and ensure qteCommandeLabel is present for the template
            java.util.List<java.util.Map<String,Object>> lignesNorm = new java.util.ArrayList<>();
            try {
                if (commande.getLignes() != null) {
                    for (com.smboutique.api.model.LigneCommande lc : commande.getLignes()) {
                        java.util.Map<String,Object> m = new java.util.HashMap<>();
                        try {
                            Integer qCond = lc.getQuantiteConditionnement();
                            Integer q = lc.getQuantite() != null ? lc.getQuantite() : 0;
                            Integer mul = null;
                            String unitLabel = null;
                            String conditionnementLabel = null;
                            // When this line recorded a specific emballage (product has 2+ packaging
                            // options), that emballage's own unite/nombreUnites is authoritative —
                            // the product's flat fields only reflect its "default" emballage.
                            com.smboutique.api.model.ProduitEmballage lcEmballage = null;
                            try { lcEmballage = lc.getEmballage(); } catch (Exception e) { lcEmballage = null; }
                            if (lcEmballage != null) {
                                mul = lcEmballage.getNombreUnites();
                                unitLabel = lcEmballage.getUnite() != null ? lcEmballage.getUnite().getLibelle() : null;
                                conditionnementLabel = unitLabel;
                            } else {
                                try {
                                    if (lc.getStock() != null && lc.getStock().getProduit() != null) {
                                        mul = lc.getStock().getProduit().getNombreUnitesParConditionnement();
                                        if (lc.getStock().getProduit().getUnite() != null) unitLabel = lc.getStock().getProduit().getUnite().getLibelle();
                                        conditionnementLabel = lc.getStock().getProduit().getUniteConditionnement();
                                    }
                                } catch (Exception e) { /* ignore */ }
                            }
                            // Cartons/conditionnement quantities must use the produit's own "unité de
                            // conditionnement" label (e.g. "Cartons"), not its base unit label (e.g.
                            // "Pièces") — they are two distinct fields and can legitimately differ.
                            String condLabel = (conditionnementLabel != null && !conditionnementLabel.isBlank()) ? conditionnementLabel : (unitLabel != null ? unitLabel : "carton");

                            String qteLabel;
                            if (qCond != null && qCond > 0) {
                                qteLabel = String.format("%d %s", qCond, condLabel);
                            } else if (q == 1) {
                                qteLabel = String.format("1 %s", unitLabel != null ? unitLabel : "U");
                            } else if (mul != null && mul > 1 && q >= mul) {
                                int boxes = q / mul;
                                int rem = q % mul;
                                if (boxes > 0 && rem > 0) qteLabel = String.format("%d %s + %d U", boxes, condLabel, rem);
                                else if (boxes > 0) qteLabel = String.format("%d %s", boxes, condLabel);
                                else qteLabel = String.format("%d U", rem);
                            } else {
                                qteLabel = String.format("%d U", q);
                            }

                            // Build a safe stock map to avoid NPE when produit or unite is null.
                            // The template shows this "unite" alongside the cartons count when the
                            // ligne is conditionnement-based, so it must carry the conditionnement
                            // label, not the base unit label.
                            java.util.Map<String, Object> stockMap = null;
                            try {
                                if (lc.getStock() != null) {
                                    java.util.Map<String, Object> produitMap = new java.util.HashMap<>();
                                    if (lc.getStock().getProduit() != null) {
                                        produitMap.put("nomProduit", lc.getStock().getProduit().getNomProduit());
                                        produitMap.put("unite", java.util.Map.of("libelle", condLabel));
                                        produitMap.put("nombreUnitesParConditionnement", mul);
                                    }
                                    if (!produitMap.isEmpty()) {
                                        stockMap = new java.util.HashMap<>();
                                        stockMap.put("produit", produitMap);
                                    }
                                }
                            } catch (Exception ignored) { /* ignore */ }

                            m.put("designation", (lc.getStock() != null && lc.getStock().getProduit() != null) ? lc.getStock().getProduit().getNomProduit() : (lc.getDesignation() != null ? lc.getDesignation() : "Produit"));
                            m.put("quantite", q);
                            m.put("quantiteConditionnement", qCond);
                            m.put("price", lc.getPrice());
                            m.put("newPrice", lc.getNewPrice());
                            m.put("montant", lc.getMontant());
                            m.put("stock", stockMap);
                            m.put("qteCommandeLabel", qteLabel);
                        } catch (Exception ex) {
                            // fallback minimal representation
                            m.put("designation", lc.getDesignation() != null ? lc.getDesignation() : "Produit");
                            int q = lc.getQuantite() != null ? lc.getQuantite() : 0;
                            m.put("quantite", q);
                            m.put("qteCommandeLabel", String.format("%d unité%s", q, (q > 1 ? "s" : "")));
                        }
                        lignesNorm.add(m);
                    }
                }
            } catch (Exception ex) {
                // ignore mapping errors
            }
            ctx.setVariable("lignesNormalized", lignesNorm);

            // Prepare formatted date string to avoid OGNL LocalDateTime -> Date conversion errors
            try {
                if (commande.getDateCommande() != null) {
                    java.time.format.DateTimeFormatter dtf = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
                    String formattedDate = commande.getDateCommande().format(dtf);
                    ctx.setVariable("dateCommandeFormatted", formattedDate);
                } else {
                    ctx.setVariable("dateCommandeFormatted", "");
                }
            } catch (Exception e) {
                ctx.setVariable("dateCommandeFormatted", "");
            }

            // Prepare safe boutique fields and currency symbol to avoid complex OGNL expressions in template
            String boutiqueNom = "";
            String boutiqueTelephone = "";
            String boutiqueAdresse = "";
            String deviseSymbole = "FCFA";
            try {
                if (commande.getBoutique() != null) {
                    if (commande.getBoutique().getNom() != null) boutiqueNom = commande.getBoutique().getNom();
                    if (commande.getBoutique().getTelephoneLocal() != null) boutiqueTelephone = commande.getBoutique().getTelephoneLocal();
                    if (commande.getBoutique().getAdresse() != null) boutiqueAdresse = commande.getBoutique().getAdresse();
                    try {
                        if (commande.getBoutique().getPays() != null && commande.getBoutique().getPays().getDeviseSymbole() != null) {
                            deviseSymbole = commande.getBoutique().getPays().getDeviseSymbole();
                        }
                    } catch (Exception ignore) {}
                }
            } catch (Exception ignore) {}
            ctx.setVariable("boutiqueNom", boutiqueNom);
            ctx.setVariable("boutiqueTelephone", boutiqueTelephone);
            ctx.setVariable("boutiqueAdresse", boutiqueAdresse);
            ctx.setVariable("deviseSymbole", deviseSymbole);

            // Prepare a preformatted total label used by the template to avoid inline expression errors
            try {
                long totalVal = commande.getTotal() != null ? commande.getTotal() : 0L;
                java.text.NumberFormat nf = java.text.NumberFormat.getIntegerInstance(java.util.Locale.FRENCH);
                String totalLabel = nf.format(totalVal) + " " + deviseSymbole;
                ctx.setVariable("commandeTotalLabel", totalLabel);
            } catch (Exception e) {
                ctx.setVariable("commandeTotalLabel", "0 " + deviseSymbole);
            }

            String html = templateEngine.process("commande_pdf", ctx);
            // Save rendered HTML for debug (so we can inspect if something goes wrong)
            try {
                java.nio.file.Files.write(java.nio.file.Paths.get("/tmp/commande_" + commandeId + "_debug.html"), html.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            } catch (Exception e) {
                // ignore; non-fatal
            }

            try (java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream()) {
                PdfRendererBuilder builder = new PdfRendererBuilder();
                builder.withHtmlContent(html, null);
                builder.toStream(baos);
                builder.run();
                byte[] pdfBytes = baos.toByteArray();
                // Définir les headers PDF au moment de l'envoi effectif
                response.setContentType("application/pdf");
                response.setHeader("Content-Disposition", "attachment; filename=commande_" + commandeId + ".pdf");
                response.getOutputStream().write(pdfBytes);
            }

        } catch (Exception e) {
            log.error("writeCommandePdf error for id={} by {} : {}", commandeId, currentUser, e.getMessage(), e);
            try {
                // Renvoyer un corps JSON explicite pour que le front affiche le détail
                response.setStatus(400);
                response.setContentType("application/json");
                String msg = e.getMessage() != null ? e.getMessage() : "Erreur inconnue";
                String body = "{\"error\":\"Erreur génération PDF commande fournisseur\",\"message\":\"" + msg.replace("\"", "\\\"") + "\"}";
                response.setHeader("Content-Length", String.valueOf(body.length()));
                response.getWriter().write(body);
                response.getWriter().flush();
                response.flushBuffer();
            } catch (Exception responseException) {
                log.error("Failed to set error response for PDF generation", responseException);
                throw new RuntimeException("Erreur génération PDF: " + e.getMessage(), e);
            }
            return;
        }
        log.info("writeCommandePdf finished for id={} by {}", commandeId, currentUser);
    }

    @Override
    public void writeHtmlPdf(String filename, String html, jakarta.servlet.http.HttpServletResponse response) throws java.io.IOException {
        org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(PdfServiceImpl.class);
        String currentUser = "anonymous";
        try {
            if (org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication() != null) {
                Object p = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
                try { currentUser = p == null ? "anonymous" : (p instanceof java.security.Principal ? ((java.security.Principal)p).getName() : p.toString()); } catch (Exception e) {}
            }
        } catch (Exception e) {}
        log.info("writeHtmlPdf start for {} by {}", filename, currentUser);

        response.setContentType("application/pdf");
        response.setHeader("Content-Disposition", "attachment; filename=" + filename);

        try (java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(baos);
            builder.run();
            byte[] pdfBytes = baos.toByteArray();
            response.getOutputStream().write(pdfBytes);
        } catch (Exception e) {
            log.error("writeHtmlPdf error for {} by {} : {}", filename, currentUser, e.getMessage(), e);
            throw new java.io.IOException(e.getMessage());
        }
        log.info("writeHtmlPdf finished for {} by {}", filename, currentUser);
    }

    private String sanitizeCurrencySymbol(String s) {
        try {
            if (s == null) return "FCFA";
            String t = s.trim();
            // Remove any leading/trailing colons or placeholder text
            t = t.replace(":", "").trim();
            if (t.isEmpty() || "devisesymbole".equalsIgnoreCase(t) || "deviseSymbole".equalsIgnoreCase(t)) return "FCFA";
            return t;
        } catch (Exception e) {
            return "FCFA";
        }
    }

    @Override
    public void writeRapportVentesPdf(String filename, java.time.LocalDate from, java.time.LocalDate to, Long boutiqueId, jakarta.servlet.http.HttpServletResponse response) throws java.io.IOException {
        var data = rapportService.ventes(from, to, boutiqueId);
        ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
        templateResolver.setPrefix("/templates/");
        templateResolver.setSuffix(".html");
        templateResolver.setTemplateMode("HTML");
        templateResolver.setCharacterEncoding("UTF-8");
        TemplateEngine templateEngine = new TemplateEngine();
        templateEngine.setTemplateResolver(templateResolver);

        Context ctx = new Context();
        ctx.setVariable("from", from);
        ctx.setVariable("to", to);
        ctx.setVariable("data", data);

        // compute totalMontant to avoid complex OGNL in template
        try {
            long total = 0L;
            if (data instanceof java.util.Collection) {
                for (Object o : (java.util.Collection<?>) data) {
                    try {
                        Object v = null;
                        if (o instanceof java.util.Map) {
                            v = ((java.util.Map<?,?>) o).get("montantTotal");
                        } else {
                            try {
                                java.lang.reflect.Method gm = o.getClass().getMethod("getMontantTotal");
                                v = gm.invoke(o);
                            } catch (NoSuchMethodException __ns) {
                                try {
                                    java.lang.reflect.Method gm2 = o.getClass().getMethod("getMontant");
                                    v = gm2.invoke(o);
                                } catch (Exception __e) { v = null; }
                            }
                        }
                        if (v != null) {
                            if (v instanceof Number) {
                                total += ((Number) v).longValue();
                            }
                        }
                    } catch (Exception e) {
                        // ignore
                    }
                }
            }
            ctx.setVariable("totalMontant", total);
        } catch (Exception ignore) { ctx.setVariable("totalMontant", 0); }

        // Attach boutique and logo if provided and set safe display variables
        if (boutiqueId != null) {
            com.smboutique.api.model.Boutique b = boutiqueRepository.findById(boutiqueId).orElse(null);
            ctx.setVariable("boutique", b);
            String logoData = null;
            String boutiqueNom = "";
            String boutiqueTelephone = "";
            String boutiqueAdresse = "";
            String deviseSymbole = "FCFA";
            try {
                if (b != null) {
                    if (b.getLogo() != null) {
                        String logoPath = b.getLogo().startsWith("/") ? b.getLogo().substring(1) : b.getLogo();
                        java.io.File f = new java.io.File(logoPath);
                        if (f.exists()) {
                            byte[] bb = java.nio.file.Files.readAllBytes(f.toPath());
                            String base64 = java.util.Base64.getEncoder().encodeToString(bb);
                            logoData = "data:image/png;base64," + base64;
                        }
                    }
                    boutiqueNom = b.getNom() != null ? b.getNom() : "";
                    boutiqueTelephone = b.getTelephoneLocal() != null ? b.getTelephoneLocal() : "";
                    boutiqueAdresse = b.getAdresse() != null ? b.getAdresse() : "";
                    try { if (b.getPays() != null && b.getPays().getDeviseSymbole() != null) deviseSymbole = b.getPays().getDeviseSymbole(); } catch (Exception ignore) {}
                }
            } catch (Exception ex) {
                // ignore
            }
            ctx.setVariable("logoBase64", logoData);
            applyCachetSignature(ctx, b);
            ctx.setVariable("boutiqueNom", boutiqueNom);
            ctx.setVariable("boutiqueTelephone", boutiqueTelephone);
            ctx.setVariable("boutiqueAdresse", boutiqueAdresse);
            deviseSymbole = sanitizeCurrencySymbol(deviseSymbole);
            ctx.setVariable("deviseSymbole", deviseSymbole);
        }

        String html = templateEngine.process("rapport_ventes", ctx);
        writeHtmlPdf(filename, html, response);
    }

    @Override
    public void writeRapportStockPdf(String filename, Long boutiqueId, jakarta.servlet.http.HttpServletResponse response) throws java.io.IOException {
        var data = rapportService.stock(boutiqueId);
        ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
        templateResolver.setPrefix("/templates/");
        templateResolver.setSuffix(".html");
        templateResolver.setTemplateMode("HTML");
        templateResolver.setCharacterEncoding("UTF-8");
        TemplateEngine templateEngine = new TemplateEngine();
        templateEngine.setTemplateResolver(templateResolver);

        Context ctx = new Context();
        ctx.setVariable("boutiqueId", boutiqueId);
        ctx.setVariable("data", data);

        if (boutiqueId != null) {
            com.smboutique.api.model.Boutique b = boutiqueRepository.findById(boutiqueId).orElse(null);
            ctx.setVariable("boutique", b);
            String logoData = null;
            try {
                if (b != null && b.getLogo() != null) {
                    String logoPath = b.getLogo().startsWith("/") ? b.getLogo().substring(1) : b.getLogo();
                    java.io.File f = new java.io.File(logoPath);
                    if (f.exists()) {
                        byte[] bb = java.nio.file.Files.readAllBytes(f.toPath());
                        String base64 = java.util.Base64.getEncoder().encodeToString(bb);
                        logoData = "data:image/png;base64," + base64;
                    }
                }
            } catch (Exception ex) {
                // ignore
            }
            ctx.setVariable("logoBase64", logoData);
            applyCachetSignature(ctx, b);
        }

        String html = templateEngine.process("rapport_stock", ctx);
        writeHtmlPdf(filename, html, response);
    }

    @Override
    public void writeRapportValeurStockPdf(String filename, Long boutiqueId, jakarta.servlet.http.HttpServletResponse response) throws java.io.IOException {
        var data = rapportService.valeurStock(boutiqueId);
        ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
        templateResolver.setPrefix("/templates/");
        templateResolver.setSuffix(".html");
        templateResolver.setTemplateMode("HTML");
        templateResolver.setCharacterEncoding("UTF-8");
        TemplateEngine templateEngine = new TemplateEngine();
        templateEngine.setTemplateResolver(templateResolver);

        Context ctx = new Context();
        ctx.setVariable("boutiqueId", boutiqueId);
        ctx.setVariable("data", data);
        ctx.setVariable("deviseSymbole", "FCFA");

        if (boutiqueId != null) {
            com.smboutique.api.model.Boutique b = boutiqueRepository.findById(boutiqueId).orElse(null);
            ctx.setVariable("boutique", b);
            String logoData = null;
            try {
                if (b != null && b.getLogo() != null) {
                    String logoPath = b.getLogo().startsWith("/") ? b.getLogo().substring(1) : b.getLogo();
                    java.io.File f = new java.io.File(logoPath);
                    if (f.exists()) {
                        byte[] bb = java.nio.file.Files.readAllBytes(f.toPath());
                        String base64 = java.util.Base64.getEncoder().encodeToString(bb);
                        logoData = "data:image/png;base64," + base64;
                    }
                }
            } catch (Exception ex) {
                // ignore
            }
            ctx.setVariable("logoBase64", logoData);
            applyCachetSignature(ctx, b);

            String boutiqueNom = "";
            String boutiqueTelephone = "";
            String boutiqueAdresse = "";
            String deviseSymbole = "FCFA";
            if (b != null) {
                if (b.getNom() != null) boutiqueNom = b.getNom();
                if (b.getTelephoneLocal() != null) boutiqueTelephone = b.getTelephoneLocal();
                if (b.getAdresse() != null) boutiqueAdresse = b.getAdresse();
                try { if (b.getPays() != null && b.getPays().getDeviseSymbole() != null) deviseSymbole = b.getPays().getDeviseSymbole(); } catch (Exception ignore) {}
            }
            try { if (deviseSymbole == null || deviseSymbole.trim().isEmpty() || "deviseSymbole".equalsIgnoreCase(deviseSymbole.trim())) deviseSymbole = "FCFA"; } catch (Exception ignore) {}
            ctx.setVariable("boutiqueNom", boutiqueNom);
            ctx.setVariable("boutiqueTelephone", boutiqueTelephone);
            ctx.setVariable("boutiqueAdresse", boutiqueAdresse);
            ctx.setVariable("deviseSymbole", deviseSymbole);
        }

        String html = templateEngine.process("rapport_valeur_stock", ctx);
        writeHtmlPdf(filename, html, response);
    }

    @Override
    public void writeRapportTopProduitsPdf(String filename, java.time.LocalDate from, java.time.LocalDate to, Long boutiqueId, int limit, jakarta.servlet.http.HttpServletResponse response) throws java.io.IOException {
        var data = rapportService.topProduits(from, to, boutiqueId, limit);
        ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
        templateResolver.setPrefix("/templates/");
        templateResolver.setSuffix(".html");
        templateResolver.setTemplateMode("HTML");
        templateResolver.setCharacterEncoding("UTF-8");
        TemplateEngine templateEngine = new TemplateEngine();
        templateEngine.setTemplateResolver(templateResolver);

        Context ctx = new Context();
        ctx.setVariable("from", from);
        ctx.setVariable("to", to);
        ctx.setVariable("data", data);

        if (boutiqueId != null) {
            com.smboutique.api.model.Boutique b = boutiqueRepository.findById(boutiqueId).orElse(null);
            ctx.setVariable("boutique", b);
            String logoData = null;
            try {
                if (b != null && b.getLogo() != null) {
                    String logoPath = b.getLogo().startsWith("/") ? b.getLogo().substring(1) : b.getLogo();
                    java.io.File f = new java.io.File(logoPath);
                    if (f.exists()) {
                        byte[] bb = java.nio.file.Files.readAllBytes(f.toPath());
                        String base64 = java.util.Base64.getEncoder().encodeToString(bb);
                        logoData = "data:image/png;base64," + base64;
                    }
                }
            } catch (Exception ex) {
                // ignore
            }
            ctx.setVariable("logoBase64", logoData);
            applyCachetSignature(ctx, b);
        }

        String html = templateEngine.process("rapport_top_produits", ctx);
        writeHtmlPdf(filename, html, response);
    }

    @Override
    public void writeInventairePdf(Long inventaireId, jakarta.servlet.http.HttpServletResponse response) throws IOException {
        org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(PdfServiceImpl.class);
        String currentUser = "anonymous";
        try {
            if (org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication() != null) {
                Object p = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
                try { currentUser = p == null ? "anonymous" : (p instanceof java.security.Principal ? ((java.security.Principal)p).getName() : p.toString()); } catch (Exception e) {}
            }
        } catch (Exception e) {}
        log.info("writeInventairePdf start for id={} by {}", inventaireId, currentUser);

        com.smboutique.api.model.Inventaire inv = inventaireRepository.findById(inventaireId).orElse(null);
        if (inv == null) {
            log.warn("writeInventairePdf: inventaire {} not found", inventaireId);
            response.sendError(404, "Inventaire introuvable");
            return;
        }

        java.util.List<com.smboutique.api.model.LigneInventaire> lignes = ligneInventaireRepository.findByInventaireId(inventaireId);

        response.setContentType("application/pdf");
        response.setHeader("Content-Disposition", "attachment; filename=inventaire_" + inventaireId + ".pdf");

        try {
            ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
            templateResolver.setPrefix("/templates/");
            templateResolver.setSuffix(".html");
            templateResolver.setTemplateMode("HTML");
            templateResolver.setCharacterEncoding("UTF-8");
            TemplateEngine templateEngine = new TemplateEngine();
            templateEngine.setTemplateResolver(templateResolver);

            Context ctx = new Context();
            ctx.setVariable("inventaire", inv);
            ctx.setVariable("lignes", lignes);

            // safe boutique display fields and resolved currency symbol
            try {
                com.smboutique.api.model.Boutique b = null;
                try { if (inv != null) b = inv.getBoutique(); } catch (Exception _e) { b = null; }
                String boutiqueNom = "";
                String boutiqueTelephone = "";
                String boutiqueAdresse = "";
                String deviseSymbole = "FCFA";
                if (b != null) {
                    if (b.getNom() != null) boutiqueNom = b.getNom();
                    if (b.getTelephoneLocal() != null) boutiqueTelephone = b.getTelephoneLocal();
                    if (b.getAdresse() != null) boutiqueAdresse = b.getAdresse();
                    try { if (b.getPays() != null && b.getPays().getDeviseSymbole() != null) deviseSymbole = b.getPays().getDeviseSymbole(); } catch (Exception ignore) {}
                }
                // sanitize common placeholder or empty values that may leak into the template
                try { if (deviseSymbole == null || deviseSymbole.trim().isEmpty() || "deviseSymbole".equalsIgnoreCase(deviseSymbole.trim())) deviseSymbole = "FCFA"; } catch (Exception ignore) {}
                ctx.setVariable("boutiqueNom", boutiqueNom);
                ctx.setVariable("boutiqueTelephone", boutiqueTelephone);
                ctx.setVariable("boutiqueAdresse", boutiqueAdresse);
                ctx.setVariable("deviseSymbole", deviseSymbole);
                applyCachetSignature(ctx, b);
            } catch (Exception ignore) {}

            // Compute the total montant across all inventory lines and expose to the template (and a preformatted label like in commande_pdf)
            try {
                int montantTotal = 0;
                if (lignes != null) {
                    for (com.smboutique.api.model.LigneInventaire li : lignes) {
                        if (li != null && li.getMontant() != null) montantTotal += li.getMontant();
                    }
                }
                ctx.setVariable("montantTotal", montantTotal);
                try {
                    java.text.NumberFormat nf = java.text.NumberFormat.getIntegerInstance(java.util.Locale.FRENCH);
                    Object dsObj = ctx.getVariable("deviseSymbole");
                    String dsStr = dsObj != null ? dsObj.toString() : "FCFA";
                    String montantTotalLabel = nf.format(montantTotal) + " " + dsStr;
                    ctx.setVariable("montantTotalLabel", montantTotalLabel);
                } catch (Exception e) {
                    Object dsObj = ctx.getVariable("deviseSymbole");
                    String dsStr = dsObj != null ? dsObj.toString() : "FCFA";
                    ctx.setVariable("montantTotalLabel", String.valueOf(montantTotal) + " " + dsStr);
                }
            } catch (Exception __e) {
                ctx.setVariable("montantTotal", 0);
                ctx.setVariable("montantTotalLabel", "0 FCFA");
            }

            String html = templateEngine.process("inventaire_pdf", ctx);

            try (java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream()) {
                PdfRendererBuilder builder = new PdfRendererBuilder();
                builder.useFastMode();
                builder.withHtmlContent(html, null);
                builder.toStream(baos);
                builder.run();
                byte[] pdfBytes = baos.toByteArray();
                response.setContentType("application/pdf");
                response.setHeader("Content-Disposition", "attachment; filename=inventaire_" + inventaireId + ".pdf");
                response.getOutputStream().write(pdfBytes);
            }
        } catch (Exception e) {
            log.error("writeInventairePdf error for id={} by {} : {}", inventaireId, currentUser, e.getMessage(), e);
            response.sendError(500, "Erreur génération PDF: " + (e.getMessage() != null ? e.getMessage() : "unknown"));
        }

        log.info("writeInventairePdf finished for id={} by {}", inventaireId, currentUser);
    }

    @Override
    public void writeReceptionPdf(Long receptionId, HttpServletResponse response) throws IOException {
        org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(PdfServiceImpl.class);
        // Build template context for reception
        com.smboutique.api.model.Reception reception = null;
        try {
            reception = receptionService.findById(receptionId).orElse(null);
        } catch (Exception e) {
            // ignore
        }
        if (reception == null) {
            response.sendError(404, "Reception not found");
            return;
        }

        try {
            ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
            templateResolver.setPrefix("/templates/");
            templateResolver.setSuffix(".html");
            templateResolver.setTemplateMode("HTML");
            templateResolver.setCharacterEncoding("UTF-8");
            TemplateEngine templateEngine = new TemplateEngine();
            templateEngine.setTemplateResolver(templateResolver);

            Context ctx = new Context();
            ctx.setVariable("reception", reception);

            // Prepare boutique logo for header (if any)
            String logoData = null;
            try {
                if (reception.getCommandeFournisseur() != null && reception.getCommandeFournisseur().getBoutique() != null && reception.getCommandeFournisseur().getBoutique().getLogo() != null) {
                    String logoPath = reception.getCommandeFournisseur().getBoutique().getLogo().startsWith("/") ? reception.getCommandeFournisseur().getBoutique().getLogo().substring(1) : reception.getCommandeFournisseur().getBoutique().getLogo();
                    java.io.File f = new java.io.File(logoPath);
                    if (f.exists()) {
                        byte[] b = java.nio.file.Files.readAllBytes(f.toPath());
                        String base64 = java.util.Base64.getEncoder().encodeToString(b);
                        logoData = "data:image/png;base64," + base64;
                    }
                }
            } catch (Exception ex) {
                // ignore but log for diagnostics
                log.warn("Failed to read boutique logo for reception {}: {}", receptionId, ex.getMessage());
            }
            ctx.setVariable("logoBase64", logoData);
            applyCachetSignature(ctx, reception.getCommandeFournisseur() != null ? reception.getCommandeFournisseur().getBoutique() : null);

            // Format date using stored LocalDateTime but normalize to UTC instant for consistent printed time
            try {
                if (reception.getDateReception() != null) {
                    java.time.format.DateTimeFormatter dtf = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
                    java.time.ZonedDateTime z = reception.getDateReception().atZone(com.smboutique.api.util.DateUtils.DAKAR).withZoneSameInstant(java.time.ZoneOffset.UTC);
                    String formattedDate = z.format(dtf);
                    ctx.setVariable("dateReceptionFormatted", formattedDate);
                } else {
                    ctx.setVariable("dateReceptionFormatted", "");
                }
            } catch (Exception e) {
                ctx.setVariable("dateReceptionFormatted", "");
            }

            // Safe boutique variables for template to avoid OGNL evaluation errors
            String boutiqueNom = "";
            String boutiqueTelephone = "";
            String boutiqueAdresse = "";
            try {
                if (reception.getCommandeFournisseur() != null && reception.getCommandeFournisseur().getBoutique() != null) {
                    com.smboutique.api.model.Boutique b = reception.getCommandeFournisseur().getBoutique();
                    if (b.getNom() != null) boutiqueNom = b.getNom();
                    if (b.getTelephoneLocal() != null) boutiqueTelephone = b.getTelephoneLocal();
                    if (b.getAdresse() != null) boutiqueAdresse = b.getAdresse();
                }
            } catch (Exception ignore) {}
            ctx.setVariable("boutiqueNom", boutiqueNom);
            ctx.setVariable("boutiqueTelephone", boutiqueTelephone);
            ctx.setVariable("boutiqueAdresse", boutiqueAdresse);

            // Build a view model for table lines so we show per-reception quantities (Qté Reçue) and remaining
            try {
                java.util.List<java.util.Map<String, Object>> lignesView = new java.util.ArrayList<>();
                java.util.List<com.smboutique.api.model.LigneReception> lignesReception = new java.util.ArrayList<>();
                try {
                    lignesReception = ligneReceptionService.findByReceptionId(reception.getId());
                } catch (Exception ex) {
                    // ignore
                }
                    // Safety: prepare a receptionLignes list to avoid template OGNL accessing null
                    java.util.List<com.smboutique.api.model.LigneCommande> receptionLignes = java.util.Collections.emptyList();
                    try {
                        if (reception.getCommandeFournisseur() != null && reception.getCommandeFournisseur().getLignes() != null) {
                            receptionLignes = reception.getCommandeFournisseur().getLignes();
                        }
                    } catch (Exception ignore) {}
                    ctx.setVariable("receptionLignes", receptionLignes);

                    // Get all receptions for this commande to be able to compute cumulative received up to each reception
                    java.util.List<com.smboutique.api.model.Reception> allRecsForCommande = java.util.Collections.emptyList();
                    try {
                        if (reception.getCommandeFournisseur() != null && reception.getCommandeFournisseur().getId() != null) {
                            allRecsForCommande = receptionService.findByCommandeFournisseurId(reception.getCommandeFournisseur().getId());
                        }
                    } catch (Exception ignore) {}
                    for (com.smboutique.api.model.LigneCommande lc : receptionLignes) {
                    java.util.Map<String, Object> m = new java.util.HashMap<>();
                    // compute base quantities for this commande line
                    Integer qteCommande = lc.getQuantite() != null ? lc.getQuantite() : 0;
                    int qteRecueThis = 0;
                    // determine a safe designation for this ligne (product name or explicit designation or fallback)
                    String designation = "Produit";
                    try {
                        if (lc.getStock() != null && lc.getStock().getProduit() != null && lc.getStock().getProduit().getNomProduit() != null) designation = lc.getStock().getProduit().getNomProduit();
                        else if (lc.getDesignation() != null) designation = lc.getDesignation();
                    } catch (Exception ignore) {}
                    java.util.List<Long> matchedIds = new java.util.ArrayList<>();
                    try {
                        qteRecueThis = 0;
                        try {
                            for (com.smboutique.api.model.LigneReception lr : lignesReception) {
                                boolean match = false;
                                try {
                                    if (lr.getProduit() != null && lr.getProduit().getId() != null && lc.getStock() != null && lc.getStock().getProduit() != null && lr.getProduit().getId().equals(lc.getStock().getProduit().getId())) match = true;
                                    else {
                                        String lrName = lr.getProduit() != null && lr.getProduit().getNomProduit() != null ? lr.getProduit().getNomProduit().trim().toLowerCase() : null;
                                        String lcName = (lc.getStock() != null && lc.getStock().getProduit() != null && lc.getStock().getProduit().getNomProduit() != null) ? lc.getStock().getProduit().getNomProduit().trim().toLowerCase() : (lc.getDesignation() != null ? lc.getDesignation().trim().toLowerCase() : null);
                                        if (lrName != null && lcName != null && lrName.equals(lcName)) match = true;
                                    }
                                } catch (Exception ignore) {}
                                if (match) {
                                    int val = lr.getQuantiteRecu() != null ? lr.getQuantiteRecu() : 0;
                                    qteRecueThis += val;
                                    if (lr.getId() != null) matchedIds.add(lr.getId());
                                }
                            }
                        } catch (Exception ignore) {}

                    } catch (Exception ignore) {}

                    // Compute cumulative received up to and including this reception
                    int cumulativeUpToThis = 0;
                    try {
                        if (allRecsForCommande != null) {
                            for (com.smboutique.api.model.Reception r : allRecsForCommande) {
                                if (r.getDateReception() == null) continue;
                                boolean beforeOrEqual = r.getDateReception().isBefore(reception.getDateReception()) || r.getDateReception().isEqual(reception.getDateReception());
                                if (!beforeOrEqual) continue;
                                // sum lines for this reception r for the product
                                java.util.List<com.smboutique.api.model.LigneReception> lrs = ligneReceptionService.findByReceptionId(r.getId());
                                int s = lrs.stream()
                                        .filter(lr -> lr.getProduit() != null && lr.getProduit().getId() != null && lc.getStock() != null && lc.getStock().getProduit() != null && lr.getProduit().getId().equals(lc.getStock().getProduit().getId()))
                                        .mapToInt(com.smboutique.api.model.LigneReception::getQuantiteRecu)
                                        .sum();
                                cumulativeUpToThis += s;
                            }
                        }
                    } catch (Exception ex) {
                        // ignore and fallback
                    }

                    int qteRestante = Math.max(qteCommande - cumulativeUpToThis, 0);

                    // Compute conditionnement-aware fields
                    Integer nombreUnites = null;
                    String uniteLibelle = null;
                    String uniteConditionnementLibelle = null;
                    try {
                        if (lc.getStock() != null && lc.getStock().getProduit() != null) {
                            nombreUnites = lc.getStock().getProduit().getNombreUnitesParConditionnement();
                            if (lc.getStock().getProduit().getUnite() != null) uniteLibelle = lc.getStock().getProduit().getUnite().getLibelle();
                            uniteConditionnementLibelle = lc.getStock().getProduit().getUniteConditionnement();
                        }
                    } catch (Exception ex) {
                        // ignore
                    }

                    Integer quantiteConditionnementCommande = null;
                    Integer quantiteConditionnementRecueThis = null;
                    Integer quantiteConditionnementRestante = null;
                    // Prefer explicit stored quantiteConditionnement on the commande ligne when available
                    try {
                        if (lc.getQuantiteConditionnement() != null && lc.getQuantiteConditionnement() > 0) {
                            quantiteConditionnementCommande = lc.getQuantiteConditionnement();
                        } else if (nombreUnites != null && nombreUnites > 1) {
                            if (qteCommande % nombreUnites == 0) quantiteConditionnementCommande = qteCommande / nombreUnites;
                        }
                        // For received and remaining, prefer explicit conditionnement values in LigneReception; otherwise derive from unit counts when divisible
                        if (nombreUnites != null && nombreUnites > 1) {
                            // derive from units
                            if (qteRecueThis % nombreUnites == 0) quantiteConditionnementRecueThis = qteRecueThis / nombreUnites;
                            if (qteRestante % nombreUnites == 0) quantiteConditionnementRestante = qteRestante / nombreUnites;
                        }
                    } catch (Exception ex) {
                        // ignore
                    }

                    m.put("designation", designation);
                    m.put("qteCommande", qteCommande);
                    m.put("qteRecueThis", qteRecueThis);
                    m.put("qteRestante", qteRestante);
                    m.put("nombreUnitesParConditionnement", nombreUnites);
                    // Key name says "conditionnement" — must hold the produit's uniteConditionnement
                    // (e.g. "Cartons"), not its base unit label, since the template uses this value
                    // directly wherever the ordered quantity divides evenly into conditionnements.
                    m.put("uniteConditionnementLibelle", (uniteConditionnementLibelle != null && !uniteConditionnementLibelle.isBlank()) ? uniteConditionnementLibelle : uniteLibelle);
                    m.put("quantiteConditionnementCommande", quantiteConditionnementCommande);
                    m.put("quantiteConditionnementRecueThis", quantiteConditionnementRecueThis);
                    m.put("quantiteConditionnementRestante", quantiteConditionnementRestante);

                    // Build human-friendly labels: conditionnement quantities (cartons) use the
                    // produit's "unité de conditionnement" label, plain unit quantities use its
                    // base unit label — these are two distinct fields and can legitimately differ.
                    try {
                        String unitLabelSafe = (uniteLibelle != null && uniteLibelle.trim().length() > 0) ? uniteLibelle : "Pieces";
                        String condLabelSafe = (uniteConditionnementLibelle != null && uniteConditionnementLibelle.trim().length() > 0) ? uniteConditionnementLibelle : unitLabelSafe;

                        // qteCommandeLabel
                        String qteCommandeLabel;
                        if (quantiteConditionnementCommande != null) {
                            qteCommandeLabel = String.format("%d %s", quantiteConditionnementCommande, condLabelSafe);
                        } else if (nombreUnites != null && nombreUnites > 1 && qteCommande % nombreUnites == 0) {
                            qteCommandeLabel = String.format("%d %s", (qteCommande / nombreUnites), condLabelSafe);
                        } else {
                            qteCommandeLabel = String.format("%d %s", qteCommande, unitLabelSafe);
                        }
                        m.put("qteCommandeLabel", qteCommandeLabel);

                        // qteRecueThisLabel
                        String qteRecueThisLabel;
                        if (quantiteConditionnementRecueThis != null) {
                            qteRecueThisLabel = String.format("%d %s", quantiteConditionnementRecueThis, condLabelSafe);
                        } else {
                            qteRecueThisLabel = String.format("%d %s", qteRecueThis, unitLabelSafe);
                        }
                        m.put("qteRecueThisLabel", qteRecueThisLabel);

                        // qteRestanteLabel
                        String qteRestanteLabel;
                        if (quantiteConditionnementRestante != null) {
                            qteRestanteLabel = String.format("%d %s", quantiteConditionnementRestante, condLabelSafe);
                        } else {
                            qteRestanteLabel = String.format("%d %s", qteRestante, unitLabelSafe);
                        }
                        m.put("qteRestanteLabel", qteRestanteLabel);
                    } catch (Exception ex) {
                        // fallback: ensure labels exist
                        m.put("qteCommandeLabel", String.valueOf(qteCommande));
                        m.put("qteRecueThisLabel", String.valueOf(qteRecueThis));
                        m.put("qteRestanteLabel", String.valueOf(qteRestante));
                    }

                    // Debug helpers to diagnose matching issues: list matched reception line ids and total available reception lines
                    m.put("matchedReceptionLineIds", matchedIds);
                    m.put("lignesReceptionCount", lignesReception != null ? lignesReception.size() : 0);
                    lignesView.add(m);
                }
                ctx.setVariable("lignesView", lignesView);
                // Debug: persist lignesView as JSON for inspection and a simple text summary
                try {
                    String j = new com.fasterxml.jackson.databind.ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(lignesView);
                    java.nio.file.Files.write(java.nio.file.Paths.get("/tmp/reception_" + receptionId + "_lines.json"), j.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                    // also write plaintext summary for easier grepping
                    StringBuilder sb = new StringBuilder();
                    for (java.util.Map<String,Object> mm : lignesView) {
                        sb.append(mm.toString()).append("\n");
                    }
                    java.nio.file.Files.write(java.nio.file.Paths.get("/tmp/reception_" + receptionId + "_lines.txt"), sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
                } catch (Exception ex) {
                    // ignore
                }
            } catch (Exception ex) {
                // ignore
            }

            String html = templateEngine.process("reception_pdf", ctx);
            // sanitize HTML for XML parser (replace named entities like &nbsp;)
            if (html != null) {
                html = html.replace("&nbsp;", "&#160;");
            }
            // save debug copy for inspection when needed
            try {
                java.nio.file.Files.write(java.nio.file.Paths.get("/tmp/reception_" + receptionId + "_debug.html"), html.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                System.err.println("DEBUG: wrote /tmp/reception_" + receptionId + "_debug.html, length=" + (html == null ? "null" : html.length()));
            } catch (Exception e) {
                System.err.println("DEBUG: failed to write debug html: " + e.getMessage());
            }

            System.err.println("DEBUG: html length=" + (html == null ? "null" : html.length()));

            try (java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream()) {
                PdfRendererBuilder builder = new PdfRendererBuilder();
                builder.useFastMode();
                builder.withHtmlContent(html, null);
                builder.toStream(baos);
                try {
                    builder.run();
                } catch (Throwable t) {
                    System.err.println("DEBUG: builder.run() failed: " + t.getMessage());
                    t.printStackTrace(System.err);
                    throw t;
                }
                byte[] pdfBytes = baos.toByteArray();

                // Only set headers after successful generation
                try {
                    response.setContentType("application/pdf");
                    response.setHeader("Content-Disposition", "attachment; filename=reception_" + receptionId + ".pdf");
                    response.getOutputStream().write(pdfBytes);
                    response.getOutputStream().flush();
                } catch (Exception ioEx) {
                    log.error("Failed to write PDF response for reception {}: {}", receptionId, ioEx.getMessage(), ioEx);
                    try { response.sendError(500, "Erreur envoi PDF: " + (ioEx.getMessage() != null ? ioEx.getMessage() : "unknown")); } catch (Exception ignored) {}
                }
                return;
            }
        } catch (Exception e) {
            log.error("writeReceptionPdf error for id={} : {}", receptionId, e.getMessage(), e);
            try { response.sendError(500, "Erreur génération PDF: " + (e.getMessage() != null ? e.getMessage() : "unknown")); } catch (Exception ignored) {}
            return;
        }
    }

    @Override
    public void writeCommandeClientPdf(Long commandeId, HttpServletResponse response) throws IOException {
        org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(PdfServiceImpl.class);
        String currentUser = "anonymous";
        try {
            if (org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication() != null) {
                Object p = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
                try { currentUser = p == null ? "anonymous" : (p instanceof java.security.Principal ? ((java.security.Principal)p).getName() : p.toString()); } catch (Exception e) {}
            }
        } catch (Exception e) {}
        log.info("writeCommandeClientPdf start for id={} by {}", commandeId, currentUser);

        // Similar to writeCommandePdf but use CommandeClient
        com.smboutique.api.model.CommandeClient commande = commandeClientService.findById(commandeId).orElse(null);
        if (commande == null) {
            response.sendError(404, "Commande client not found");
            return;
        }
        // Ne pas définir les headers PDF avant d'être certain que la génération réussit

        try {
            ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
            templateResolver.setPrefix("/templates/");
            templateResolver.setSuffix(".html");
            templateResolver.setTemplateMode("HTML");
            templateResolver.setCharacterEncoding("UTF-8");
            TemplateEngine templateEngine = new TemplateEngine();
            templateEngine.setTemplateResolver(templateResolver);

            Context ctx = new Context();
            // reuse the same 'commande' variable in template
            ctx.setVariable("commande", commande);
            String logoData = null;
            try {
                if (commande.getBoutique() != null && commande.getBoutique().getLogo() != null) {
                    String logoPath = commande.getBoutique().getLogo().startsWith("/") ? commande.getBoutique().getLogo().substring(1) : commande.getBoutique().getLogo();
                    java.io.File f = new java.io.File(logoPath);
                    if (f.exists()) {
                        byte[] b = java.nio.file.Files.readAllBytes(f.toPath());
                        String base64 = java.util.Base64.getEncoder().encodeToString(b);
                        logoData = "data:image/png;base64," + base64;
                    }
                }
            } catch (Exception ex) {
                // ignore
            }
            ctx.setVariable("logoBase64", logoData);
            applyCachetSignature(ctx, commande.getBoutique());

            // Prepare formatted date string to avoid OGNL LocalDateTime -> Date conversion errors
            try {
                if (commande.getDateCommande() != null) {
                    java.time.format.DateTimeFormatter dtf = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
                    String formattedDate = commande.getDateCommande().format(dtf);
                    ctx.setVariable("dateCommandeFormatted", formattedDate);
                } else {
                    ctx.setVariable("dateCommandeFormatted", "");
                }
            } catch (Exception e) {
                ctx.setVariable("dateCommandeFormatted", "");
            }

            // Prepare safe boutique fields and currency symbol to avoid complex OGNL expressions in template
            String boutiqueNom = "";
            String boutiqueTelephone = "";
            String boutiqueAdresse = "";
            String deviseSymbole = "FCFA";
            try {
                if (commande.getBoutique() != null) {
                    if (commande.getBoutique().getNom() != null) boutiqueNom = commande.getBoutique().getNom();
                    if (commande.getBoutique().getTelephoneLocal() != null) boutiqueTelephone = commande.getBoutique().getTelephoneLocal();
                    if (commande.getBoutique().getAdresse() != null) boutiqueAdresse = commande.getBoutique().getAdresse();
                    try {
                        if (commande.getBoutique().getPays() != null && commande.getBoutique().getPays().getDeviseSymbole() != null) {
                            deviseSymbole = commande.getBoutique().getPays().getDeviseSymbole();
                        }
                    } catch (Exception ignore) {}
                }
            } catch (Exception ignore) {}
            ctx.setVariable("boutiqueNom", boutiqueNom);
            ctx.setVariable("boutiqueTelephone", boutiqueTelephone);
            ctx.setVariable("boutiqueAdresse", boutiqueAdresse);
            ctx.setVariable("deviseSymbole", deviseSymbole);

            // Prepare a preformatted total label used by the template to avoid inline expression errors
            try {
                long totalVal = commande.getTotal() != null ? commande.getTotal() : 0L;
                // Reçu revendeur : total en prix revendeur si au moins une ligne en a un (affichage uniquement).
                try {
                    long revTotal = 0L; boolean hasRev = false;
                    if (commande.getLignes() != null) {
                        for (com.smboutique.api.model.LigneCommandeClient lx : commande.getLignes()) {
                            int qx = lx.getQuantite() != null ? lx.getQuantite() : 0;
                            if (lx.getPrixRevendeur() != null) { hasRev = true; revTotal += (long) lx.getPrixRevendeur() * qx; }
                            else { revTotal += (long) (lx.getNewPrice() != null ? lx.getNewPrice() : 0) * qx; }
                        }
                    }
                    if (hasRev) totalVal = revTotal;
                } catch (Exception __e) { /* fallback: total réel */ }
                java.text.NumberFormat nf = java.text.NumberFormat.getIntegerInstance(java.util.Locale.FRENCH);
                String totalLabel = nf.format(totalVal) + " " + deviseSymbole;
                ctx.setVariable("commandeTotalLabel", totalLabel);
            } catch (Exception e) {
                ctx.setVariable("commandeTotalLabel", "0 " + deviseSymbole);
            }

            // Build a normalized representation of lines so the Thymeleaf template
            // can safely access common properties (designation, stock.produit.*)
            java.util.List<java.util.Map<String,Object>> lignesNorm = new java.util.ArrayList<>();
            try {
                if (commande.getLignes() != null) {
                    for (com.smboutique.api.model.LigneCommandeClient l : commande.getLignes()) {
                        java.util.Map<String,Object> m = new java.util.HashMap<>();
                        // Determine designation safely: prefer product name, otherwise attempt reflective getter if available
                        String designation = null;
                        try {
                            if (l.getProduit() != null && l.getProduit().getNomProduit() != null) designation = l.getProduit().getNomProduit();
                            else {
                                try {
                                    java.lang.reflect.Method gd = l.getClass().getMethod("getDesignation");
                                    Object gdv = gd.invoke(l);
                                    if (gdv != null) designation = gdv.toString();
                                } catch (NoSuchMethodException ignore) {}
                            }
                        } catch (Exception ignore) { }
                        m.put("designation", designation);
                        m.put("quantiteConditionnement", l.getQuantiteConditionnement());
                        m.put("quantite", l.getQuantite());
                        // Use newPrice as the effective unit price when present; fall back to product prixDetail/prixEnGros if available
                        Integer unitPrice = 0;
                        try {
                            // Reçu revendeur : le prix revendeur (si saisi) remplace le prix réel à l'AFFICHAGE.
                            if (l.getPrixRevendeur() != null) unitPrice = l.getPrixRevendeur();
                            else if (l.getNewPrice() != null) unitPrice = l.getNewPrice();
                            else if (l.getProduit() != null && l.getProduit().getPrixDetail() != null) unitPrice = l.getProduit().getPrixDetail();
                            else if (l.getProduit() != null && l.getProduit().getPrixEnGros() != null) unitPrice = l.getProduit().getPrixEnGros();
                        } catch (Exception ex) {
                            // Defensive: if any accessor is missing at runtime, fall back to 0
                            unitPrice = 0;
                        }
                        m.put("price", unitPrice);
                        m.put("newPrice", unitPrice);

                        // Compute line montant = unitPrice * quantity (quantity in units)
                        int qty = l.getQuantite() != null ? l.getQuantite() : 0;
                        int montantVal = unitPrice * qty;
                        // If the Ligne object has an explicit getter getMontant(), prefer it (use reflection safely)
                        try {
                            java.lang.reflect.Method gm = l.getClass().getMethod("getMontant");
                            Object gmv = gm.invoke(l);
                            if (gmv instanceof Number) {
                                montantVal = ((Number) gmv).intValue();
                            }
                        } catch (NoSuchMethodException ignore) {
                            // nothing
                        } catch (Exception ex) {
                            // log and continue with computed montant
                            org.slf4j.LoggerFactory.getLogger(PdfServiceImpl.class).warn("Unable to read montant via reflection for ligne: {}", ex.getMessage());
                        }
                        m.put("montant", montantVal);

                        // When this line recorded a specific emballage (product has 2+ packaging
                        // options), that emballage's own unite/nombreUnites is authoritative.
                        com.smboutique.api.model.ProduitEmballage lEmballage = null;
                        try { lEmballage = l.getEmballage(); } catch (Exception ex) { lEmballage = null; }

                        java.util.Map<String,Object> stock = new java.util.HashMap<>();
                        java.util.Map<String,Object> produitMap = new java.util.HashMap<>();
                        if (l.getProduit() != null) {
                            produitMap.put("nomProduit", l.getProduit().getNomProduit());
                            produitMap.put("prixAchat", l.getProduit().getPrixAchat());
                            produitMap.put("nombreUnitesParConditionnement", lEmballage != null ? lEmballage.getNombreUnites() : l.getProduit().getNombreUnitesParConditionnement());
                            // Template shows this "unite" alongside the cartons count, so it must
                            // carry the conditionnement label, not the base unit label.
                            String condLbl = lEmballage != null && lEmballage.getUnite() != null ? lEmballage.getUnite().getLibelle() : l.getProduit().getUniteConditionnement();
                            if (condLbl == null || condLbl.isBlank()) {
                                condLbl = l.getProduit().getUnite() != null ? l.getProduit().getUnite().getLibelle() : null;
                            }
                            if (condLbl != null) {
                                java.util.Map<String,Object> uniteMap = new java.util.HashMap<>();
                                uniteMap.put("libelle", condLbl);
                                produitMap.put("unite", uniteMap);
                            }
                        }
                        stock.put("produit", produitMap);
                        m.put("stock", stock);
                        // Prepare a simple quantity label for the commande PDF: either "X <libelle>" when conditionnement, or "N unité(s)" otherwise
                        try {
                            String qteLabel;
                            Integer qCond = l.getQuantiteConditionnement();
                            Integer q = l.getQuantite() != null ? l.getQuantite() : 0;
                            Integer mul = null;
                            String unitLabel = null;
                            String conditionnementLabel = null;
                            if (lEmballage != null) {
                                mul = lEmballage.getNombreUnites();
                                unitLabel = lEmballage.getUnite() != null ? lEmballage.getUnite().getLibelle() : null;
                                conditionnementLabel = unitLabel;
                            } else {
                                try { if (l.getProduit() != null) mul = l.getProduit().getNombreUnitesParConditionnement(); } catch (Exception ex) {}
                                try { if (l.getProduit() != null && l.getProduit().getUnite() != null) unitLabel = l.getProduit().getUnite().getLibelle(); } catch (Exception e) {}
                                try { if (l.getProduit() != null) conditionnementLabel = l.getProduit().getUniteConditionnement(); } catch (Exception e) {}
                            }
                            // Cartons/conditionnement quantities must use the produit's own "unité de
                            // conditionnement" label, not its base unit label — they can differ.
                            String condLabel = (conditionnementLabel != null && !conditionnementLabel.isBlank()) ? conditionnementLabel : (unitLabel != null ? unitLabel : "carton");
                            if (qCond == null) {
                                // New rule:
                                // - if quantity == 1 -> show "1 <libelle>" (preferred unit label)
                                // - else if mul exists and qty >= mul -> show boxes (+rem U)
                                // - else -> show "N U"
                                if (q == 1) {
                                    qteLabel = String.format("1 %s", unitLabel != null ? unitLabel : "U");
                                } else if (mul != null && mul > 1 && q >= mul) {
                                    int boxes = q / mul;
                                    int rem = q % mul;
                                    if (boxes > 0 && rem > 0) {
                                        qteLabel = String.format("%d %s + %d U", boxes, condLabel, rem);
                                    } else if (boxes > 0) {
                                        qteLabel = String.format("%d %s", boxes, condLabel);
                                    } else {
                                        qteLabel = String.format("%d U", rem);
                                    }
                                } else {
                                    qteLabel = String.format("%d U", q);
                                }
                            } else {
                                // when present, show the quantiteConditionnement + unit libelle
                                qteLabel = String.format("%d %s", qCond, condLabel);
                            }
                            m.put("qteCommandeLabel", qteLabel);
                        } catch (Exception e) { m.put("qteCommandeLabel", (l.getQuantite() != null ? String.format("%d unité%s", l.getQuantite(), (l.getQuantite() > 1 ? "s" : "")) : "0 unité")); }
                        lignesNorm.add(m);
                    }
                }
            } catch (Exception ex) {
                // ignore mapping errors
            }
            ctx.setVariable("lignesNormalized", lignesNorm);

            String html = templateEngine.process("commande_pdf", ctx);
            try {
                java.nio.file.Files.write(java.nio.file.Paths.get("/tmp/commande_client_" + commandeId + "_debug.html"), html.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            } catch (Exception e) {
                // ignore
            }

            try (java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream()) {
                PdfRendererBuilder builder = new PdfRendererBuilder();
                builder.useFastMode();
                builder.withHtmlContent(html, null);
                builder.toStream(baos);
                builder.run();
                byte[] pdfBytes = baos.toByteArray();
                response.setContentType("application/pdf");
                response.setHeader("Content-Disposition", "attachment; filename=commande_client_" + commandeId + ".pdf");
                response.getOutputStream().write(pdfBytes);
            }
        } catch (Exception e) {
            log.error("writeCommandeClientPdf error for id={} by {} : {}", commandeId, currentUser, e.getMessage(), e);
            try {
                response.setStatus(500);
                response.setContentType("application/json");
                String msg = e.getMessage() != null ? e.getMessage() : "Erreur inconnue";
                String body = "{\"error\":\"Erreur génération PDF commande client\",\"message\":\"" + msg.replace("\"", "\\\"") + "\"}";
                byte[] bytes = body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                response.setHeader("Content-Length", String.valueOf(bytes.length));
                response.getOutputStream().write(bytes);
                response.getOutputStream().flush();
            } catch (Exception ignore) {}
            return;
        }
        log.info("writeCommandeClientPdf finished for id={} by {}", commandeId, currentUser);
    }

    @Override
    public void writeCaisseTransactionPdf(Long transactionId, HttpServletResponse response) throws IOException {
        com.smboutique.api.model.CaisseTransaction tx = null;
        try {
            tx = caisseTransactionRepository.findById(transactionId).orElse(null);
        } catch (Exception e) {
            // ignore
        }
        if (tx == null) {
            response.sendError(404, "Caisse transaction not found");
            return;
        }

        response.setContentType("application/pdf");
        response.setHeader("Content-Disposition", "attachment; filename=caisse_transaction_" + transactionId + ".pdf");

        try {
            ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
            templateResolver.setPrefix("/templates/");
            templateResolver.setSuffix(".html");
            templateResolver.setTemplateMode("HTML");
            templateResolver.setCharacterEncoding("UTF-8");
            TemplateEngine templateEngine = new TemplateEngine();
            templateEngine.setTemplateResolver(templateResolver);

            Context ctx = new Context();
            ctx.setVariable("transaction", tx);

            String logoData = null;
            com.smboutique.api.model.Boutique b = null;
            try {
                if (tx.getBoutiqueId() != null) {
                    b = boutiqueRepository.findById(tx.getBoutiqueId()).orElse(null);
                    if (b != null && b.getLogo() != null) {
                        String logoPath = b.getLogo().startsWith("/") ? b.getLogo().substring(1) : b.getLogo();
                        java.io.File f = new java.io.File(logoPath);
                        if (f.exists()) {
                            byte[] bytes = java.nio.file.Files.readAllBytes(f.toPath());
                            logoData = "data:image/png;base64," + java.util.Base64.getEncoder().encodeToString(bytes);
                        }
                    }
                }
            } catch (Exception ex) {
                // ignore
            }
            ctx.setVariable("logoBase64", logoData);
            applyCachetSignature(ctx, b);
            if (b != null) {
                ctx.setVariable("boutique", b);
                // safe variables for footer
                ctx.setVariable("boutiqueNom", b.getNom() != null ? b.getNom() : "");
                ctx.setVariable("boutiqueTelephone", b.getTelephoneLocal() != null ? b.getTelephoneLocal() : "");
                ctx.setVariable("boutiqueAdresse", b.getAdresse() != null ? b.getAdresse() : "");
                String deviseSymbole = "FCFA";
                try { if (b.getPays() != null && b.getPays().getDeviseSymbole() != null) deviseSymbole = b.getPays().getDeviseSymbole(); } catch (Exception ignore) {}
                // sanitize common placeholder or empty values that may leak into the template
                try { if (deviseSymbole == null || deviseSymbole.trim().isEmpty() || "deviseSymbole".equalsIgnoreCase(deviseSymbole.trim())) deviseSymbole = "FCFA"; } catch (Exception ignore) {}
                ctx.setVariable("deviseSymbole", deviseSymbole);
            } else {
                ctx.setVariable("boutiqueNom", "");
                ctx.setVariable("boutiqueTelephone", "");
                ctx.setVariable("boutiqueAdresse", "");
                ctx.setVariable("deviseSymbole", "FCFA");
            }

            // Set transaction (alias tx) and reference for template
            try {
                ctx.setVariable("tx", tx);
                ctx.setVariable("reference", tx.getReferenceCaisse() != null ? tx.getReferenceCaisse() : "");
            } catch (Exception ignore) { ctx.setVariable("reference", ""); }

            // Resolve a user-friendly label for the user who created the transaction
            try {
                String utilisateurLabel = "";
                if (tx.getUserId() != null) {
                    try {
                        java.util.Optional<com.smboutique.api.model.Utilisateur> uOpt = utilisateurService.findById(tx.getUserId());
                        if (uOpt.isPresent()) {
                            com.smboutique.api.model.Utilisateur u = uOpt.get();
                            StringBuilder sb = new StringBuilder();
                            if (u.getNom() != null) sb.append(u.getNom());
                            if (u.getPrenom() != null) { if (sb.length() > 0) sb.append(' '); sb.append(u.getPrenom()); }
                            utilisateurLabel = sb.toString();
                        }
                    } catch (Exception ignore) {}
                }
                if (utilisateurLabel == null || utilisateurLabel.trim().isEmpty()) utilisateurLabel = tx.getUserId() != null ? String.valueOf(tx.getUserId()) : "";
                ctx.setVariable("utilisateurLabel", utilisateurLabel);
            } catch (Exception ignore) { ctx.setVariable("utilisateurLabel", ""); }

            // Prepare formatted montant labels to avoid inline template expressions
            try {
                int montantVal = tx.getMontant() != null ? tx.getMontant() : 0;
                java.text.NumberFormat nf = java.text.NumberFormat.getIntegerInstance(java.util.Locale.FRENCH);
                String montantFormatted = nf.format(montantVal);
                Object dsObj = ctx.getVariable("deviseSymbole");
                String dsStr = dsObj != null ? dsObj.toString() : "FCFA";
                String montantLabel = montantFormatted + " " + dsStr;
                ctx.setVariable("montantFormatted", montantFormatted);
                ctx.setVariable("montantLabel", montantLabel);
            } catch (Exception e) {
                ctx.setVariable("montantFormatted", "0");
                ctx.setVariable("montantLabel", "0 FCFA");
            }

            try {
                // CaisseTransaction uses `createdAt` as the timestamp
                if (tx.getCreatedAt() != null) {
                    java.time.format.DateTimeFormatter dtf = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
                    ctx.setVariable("dateTransactionFormatted", tx.getCreatedAt().format(dtf));
                } else {
                    ctx.setVariable("dateTransactionFormatted", "");
                }
            } catch (Exception e) { ctx.setVariable("dateTransactionFormatted", ""); }

            String html = templateEngine.process("caisse_pdf", ctx);
            try (java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream()) {
                PdfRendererBuilder builder = new PdfRendererBuilder();
                builder.useFastMode();
                builder.withHtmlContent(html, null);
                builder.toStream(baos);
                builder.run();
                byte[] pdfBytes = baos.toByteArray();
                response.getOutputStream().write(pdfBytes);
            }
        } catch (Exception e) {
            throw new IOException(e.getMessage());
        }
    }

    @Override
    public void writeDepensePdf(Long depenseId, HttpServletResponse response) throws IOException {
        org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(PdfServiceImpl.class);
        String currentUser = "anonymous";
        try {
            if (org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication() != null) {
                Object p = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
                try { currentUser = p == null ? "anonymous" : (p instanceof java.security.Principal ? ((java.security.Principal)p).getName() : p.toString()); } catch (Exception e) {}
            }
        } catch (Exception e) {}
        log.info("writeDepensePdf start for id={} by {}", depenseId, currentUser);

        com.smboutique.api.model.Depense dep = null;
        try {
            dep = depenseService.findById(depenseId).orElse(null);
        } catch (Exception ex) {
            // ignore
        }
        if (dep == null) {
            log.warn("writeDepensePdf: depense {} not found", depenseId);
            response.sendError(404, "Depense not found");
            return;
        }

        response.setContentType("application/pdf");
        response.setHeader("Content-Disposition", "attachment; filename=depense_" + depenseId + ".pdf");

        try {
            ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
            templateResolver.setPrefix("/templates/");
            templateResolver.setSuffix(".html");
            templateResolver.setTemplateMode("HTML");
            templateResolver.setCharacterEncoding("UTF-8");
            TemplateEngine templateEngine = new TemplateEngine();
            templateEngine.setTemplateResolver(templateResolver);

            Context ctx = new Context();
            ctx.setVariable("depense", dep);

            // boutique info for footer/display
            com.smboutique.api.model.Boutique b = null;
            try {
                if (dep != null && dep.getBoutiqueId() != null) b = boutiqueRepository.findById(dep.getBoutiqueId()).orElse(null);
            } catch (Exception _e) { b = null; }
            if (b != null) {
                ctx.setVariable("boutiqueNom", b.getNom() != null ? b.getNom() : "");
                ctx.setVariable("boutiqueTelephone", b.getTelephoneLocal() != null ? b.getTelephoneLocal() : "");
                ctx.setVariable("boutiqueAdresse", b.getAdresse() != null ? b.getAdresse() : "");
                String deviseSymbole = "FCFA";
                try { if (b.getPays() != null && b.getPays().getDeviseSymbole() != null) deviseSymbole = b.getPays().getDeviseSymbole(); } catch (Exception _e) {}
                ctx.setVariable("deviseSymbole", deviseSymbole);
                if (dep.getMontant() != null) ctx.setVariable("montantLabel", dep.getMontant() + " " + deviseSymbole);
                else ctx.setVariable("montantLabel", "0 " + deviseSymbole);
            } else {
                ctx.setVariable("boutiqueNom", "");
                ctx.setVariable("boutiqueTelephone", "");
                ctx.setVariable("boutiqueAdresse", "");
                ctx.setVariable("deviseSymbole", "FCFA");
                ctx.setVariable("montantLabel", (dep.getMontant() != null ? dep.getMontant() : 0) + " FCFA");
            }

            try {
                if (dep.getCreatedAt() != null) {
                    java.time.format.DateTimeFormatter dtf = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
                    String formattedDate = dep.getCreatedAt().format(dtf);
                    ctx.setVariable("dateCreatedFormatted", formattedDate);
                } else {
                    ctx.setVariable("dateCreatedFormatted", "");
                }
            } catch (Exception e) { ctx.setVariable("dateCreatedFormatted", ""); }

            applyCachetSignature(ctx, b);
            String html = templateEngine.process("depense_pdf", ctx);
            try {
                java.nio.file.Files.write(java.nio.file.Paths.get("/tmp/depense_" + depenseId + "_debug.html"), html.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            } catch (Exception e) { /* ignore */ }

            try (java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream()) {
                PdfRendererBuilder builder = new PdfRendererBuilder();
                builder.useFastMode();
                builder.withHtmlContent(html, null);
                builder.toStream(baos);
                builder.run();
                byte[] pdfBytes = baos.toByteArray();
                response.getOutputStream().write(pdfBytes);
            }
        } catch (Exception e) {
            log.error("writeDepensePdf error for id={} by {} : {}", depenseId, currentUser, e.getMessage(), e);
            throw new IOException(e.getMessage());
        }
        log.info("writeDepensePdf finished for id={} by {}", depenseId, currentUser);
    }

    @Override
    public void writeVentePdf(Long venteId, jakarta.servlet.http.HttpServletResponse response) throws IOException {
        org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(PdfServiceImpl.class);
        String currentUser = "anonymous";
        try {
            if (org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication() != null) {
                Object p = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
                try { currentUser = p == null ? "anonymous" : (p instanceof java.security.Principal ? ((java.security.Principal)p).getName() : p.toString()); } catch (Exception e) {}
            }
        } catch (Exception e) {}
        log.info("writeVentePdf start for id={} by {}", venteId, currentUser);

        com.smboutique.api.model.Vente vente = null;
        try {
            vente = venteService.findById(venteId).orElse(null);
        } catch (Exception e) { /* ignore */ }
        if (vente == null) {
            log.warn("writeVentePdf: vente {} not found", venteId);
            response.sendError(404, "Vente not found");
            return;
        }

        response.setContentType("application/pdf");
        response.setHeader("Content-Disposition", "attachment; filename=vente_" + venteId + ".pdf");

        try {
            ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
            templateResolver.setPrefix("/templates/");
            templateResolver.setSuffix(".html");
            templateResolver.setTemplateMode("HTML");
            templateResolver.setCharacterEncoding("UTF-8");
            TemplateEngine templateEngine = new TemplateEngine();
            templateEngine.setTemplateResolver(templateResolver);

            Context ctx = new Context();
            ctx.setVariable("vente", vente);

            // boutique info for footer/display
            com.smboutique.api.model.Boutique b = null;
            try { b = vente.getBoutique(); } catch (Exception _e) { b = null; }
            if (b != null) {
                ctx.setVariable("boutiqueNom", b.getNom() != null ? b.getNom() : "");
                ctx.setVariable("boutiqueTelephone", b.getTelephoneLocal() != null ? b.getTelephoneLocal() : "");
                ctx.setVariable("boutiqueAdresse", b.getAdresse() != null ? b.getAdresse() : "");
                String deviseSymbole = "FCFA";
                try { if (b.getPays() != null && b.getPays().getDeviseSymbole() != null) deviseSymbole = b.getPays().getDeviseSymbole(); } catch (Exception __e) {}
                ctx.setVariable("deviseSymbole", deviseSymbole);
                // prepare logoBase64 if available
                try {
                    if (b.getLogo() != null) {
                        String logoPath = b.getLogo().startsWith("/") ? b.getLogo().substring(1) : b.getLogo();
                        java.io.File f = new java.io.File(logoPath);
                        if (f.exists()) {
                            byte[] lb = java.nio.file.Files.readAllBytes(f.toPath());
                            String base64 = java.util.Base64.getEncoder().encodeToString(lb);
                            ctx.setVariable("logoBase64", "data:image/png;base64," + base64);
                        } else {
                            ctx.setVariable("logoBase64", null);
                        }
                    } else {
                        ctx.setVariable("logoBase64", null);
                    }
                } catch (Exception __e) { ctx.setVariable("logoBase64", null); }
            } else {
                ctx.setVariable("boutiqueNom", "");
                ctx.setVariable("boutiqueTelephone", "");
                ctx.setVariable("boutiqueAdresse", "");
                ctx.setVariable("deviseSymbole", "FCFA");
                ctx.setVariable("logoBase64", null);
            }
            applyCachetSignature(ctx, b);

            // Build normalized lignes for template with qte label
            java.util.List<java.util.Map<String,Object>> lignesNorm = new java.util.ArrayList<>();
            try {
                java.util.List<com.smboutique.api.model.LigneVente> lignes = ligneVenteService.findAll();
                lignes.removeIf(lv -> lv.getVente() == null || lv.getVente().getId() == null || !lv.getVente().getId().equals(venteId));
                for (com.smboutique.api.model.LigneVente lv : lignes) {
                    java.util.Map<String,Object> m = new java.util.HashMap<>();
                    try {
                        // normalize produit to a simple map to avoid template null accesses
                        // When this line recorded a specific emballage (product has 2+ packaging
                        // options), that emballage's own unite/nombreUnites is authoritative —
                        // the product's flat fields only reflect its "default" emballage and would
                        // print the wrong pack size/label for a line sold with a different one.
                        com.smboutique.api.model.ProduitEmballage lvEmballage = null;
                        try { lvEmballage = lv.getEmballage(); } catch (Exception __e) { lvEmballage = null; }

                        Integer mul = null;
                        String unitLabel = null;
                        String conditionnementLabel = null;
                        if (lvEmballage != null) {
                            mul = lvEmballage.getNombreUnites();
                            unitLabel = lvEmballage.getUnite() != null ? lvEmballage.getUnite().getLibelle() : null;
                            conditionnementLabel = unitLabel;
                        } else {
                            try { if (lv.getProduit() != null) mul = lv.getProduit().getNombreUnitesParConditionnement(); } catch (Exception ex) {}
                            try { if (lv.getProduit() != null && lv.getProduit().getUnite() != null) unitLabel = lv.getProduit().getUnite().getLibelle(); } catch (Exception ex) {}
                            try { if (lv.getProduit() != null) conditionnementLabel = lv.getProduit().getUniteConditionnement(); } catch (Exception ex) {}
                        }

                        java.util.Map<String,Object> produitMap = null;
                        try {
                            if (lv.getProduit() != null) {
                                produitMap = new java.util.HashMap<>();
                                produitMap.put("nomProduit", lv.getProduit().getNomProduit() != null ? lv.getProduit().getNomProduit() : "Produit");
                                produitMap.put("unite", unitLabel != null ? java.util.Map.of("libelle", unitLabel) : null);
                                produitMap.put("nombreUnitesParConditionnement", mul);
                                // Template reads this directly (vente_pdf.html) for the "issue de N
                                // <uniteConditionnement>" hint — was missing, so it always fell back
                                // to the generic "emballage" placeholder instead of the real label.
                                produitMap.put("uniteConditionnement", conditionnementLabel);
                            }
                        } catch (Exception __e) { produitMap = null; }
                        m.put("produit", produitMap);

                        Integer qCond = lv.getQuantiteConditionnement();
                        Integer q = lv.getQuantite() != null ? lv.getQuantite() : 0;
                        // Cartons/conditionnement quantities must use the produit's own "unité de
                        // conditionnement" label, not its base unit label — they can differ.
                        String uLbl = (conditionnementLabel != null && !conditionnementLabel.isBlank()) ? conditionnementLabel : (unitLabel != null ? unitLabel : "carton");

                        boolean isPureConditionnement = false;
                        try {
                            isPureConditionnement = qCond != null && qCond > 0 && mul != null && mul > 1 && q != null && q.equals(qCond * mul);
                        } catch (Exception ex) { isPureConditionnement = false; }

                        String qteLabel;
                        if (qCond != null && isPureConditionnement) {
                            qteLabel = String.format("%d %s", qCond, uLbl);
                        } else {
                            qteLabel = String.format("%d U", q);
                        }

                        m.put("quantite", q);
                        m.put("quantiteConditionnement", qCond);
                        m.put("showConditionnementInfo", qCond != null && qCond > 0 && mul != null && mul > 1);
                        if (qCond != null && qCond > 0 && mul != null && mul > 1) {
                            if (isPureConditionnement) {
                                m.put("conditionnementInfoLabel", String.format("%d %s (= %d unités)", qCond, uLbl, q));
                            } else {
                                m.put("conditionnementInfoLabel", String.format("Vendu: %d U (issu de %d %s)", q, qCond, uLbl));
                            }
                        }

                        // Ensure numeric defaults for prices to avoid nulls in templates
                        long priceVal = 0L;
                        try {
                            // Reçu revendeur : le prix revendeur (si saisi) remplace le prix réel à l'AFFICHAGE uniquement.
                            if (lv.getPrixRevendeur() != null) priceVal = lv.getPrixRevendeur();
                            else if (lv.getNewPrice() != null) priceVal = lv.getNewPrice();
                            else if (lv.getProduit() != null && lv.getProduit().getPrixAchat() != null) priceVal = lv.getProduit().getPrixAchat();
                        } catch (Exception __e) { priceVal = 0L; }
                        long prixAchatVal = 0L;
                        try { if (lv.getProduit() != null && lv.getProduit().getPrixAchat() != null) prixAchatVal = lv.getProduit().getPrixAchat(); } catch (Exception __e) { prixAchatVal = 0L; }

                        m.put("newPrice", priceVal);
                        m.put("prix", prixAchatVal);
                        m.put("montant", priceVal * q);
                        m.put("qteLabel", qteLabel);
                    } catch (Exception ex) {
                        m.put("quantite", lv.getQuantite() != null ? lv.getQuantite() : 0);
                        m.put("qteLabel", lv.getQuantite() != null ? String.format("%d U", lv.getQuantite()) : "0 U");
                    }
                    lignesNorm.add(m);
                }
            } catch (Exception e) { /* ignore */ }
            ctx.setVariable("lignes", lignesNorm);

            try {
                if (vente.getDateVente() != null) {
                    java.time.format.DateTimeFormatter dtf = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
                    String formattedDate = vente.getDateVente().format(dtf);
                    ctx.setVariable("dateVenteFormatted", formattedDate);
                } else {
                    ctx.setVariable("dateVenteFormatted", "");
                }
            } catch (Exception e) { ctx.setVariable("dateVenteFormatted", ""); }

            // Prepare formatted labels (currency-aware) and enrich each ligne with price/montant labels
            String deviseSymboleLocal = null;
            try {
                Object ds = ctx.getVariable("deviseSymbole");
                if (ds instanceof String && ((String)ds).trim().length() > 0 && !"#".equals(((String)ds).trim())) {
                    deviseSymboleLocal = (String) ds;
                } else if (vente != null && vente.getBoutique() != null && vente.getBoutique().getPays() != null) {
                    if (vente.getBoutique().getPays().getDeviseSymbole() != null && !"#".equals(vente.getBoutique().getPays().getDeviseSymbole().trim())) {
                        deviseSymboleLocal = vente.getBoutique().getPays().getDeviseSymbole();
                    } else if (vente.getBoutique().getPays().getDeviseCode() != null) {
                        // map common currency codes to readable symbols when possible
                        String code = vente.getBoutique().getPays().getDeviseCode().trim().toUpperCase();
                        switch (code) {
                            case "XOF": deviseSymboleLocal = "FCFA"; break;
                            case "XAF": deviseSymboleLocal = "FCFA"; break;
                            case "GNF": deviseSymboleLocal = "GNF"; break;
                            case "GHS": deviseSymboleLocal = "₵"; break;
                            default: deviseSymboleLocal = code; break;
                        }
                    }
                }
                if (deviseSymboleLocal == null || deviseSymboleLocal.trim().length() == 0) {
                    deviseSymboleLocal = "FCFA";
                }
            } catch (Exception __e) { deviseSymboleLocal = "FCFA"; }
            ctx.setVariable("deviseSymbole", deviseSymboleLocal);
            // also expose devise code (if available) and compute a safe label (append code when symbol is non-ASCII)
            String deviseCodeLocal = null;
            try {
                Object dc = ctx.getVariable("deviseCode");
                if (dc instanceof String && ((String) dc).trim().length() > 0) deviseCodeLocal = (String) dc;
                else if (vente != null && vente.getBoutique() != null && vente.getBoutique().getPays() != null && vente.getBoutique().getPays().getDeviseCode() != null) deviseCodeLocal = vente.getBoutique().getPays().getDeviseCode();
            } catch (Exception __e) { /* ignore */ }
            ctx.setVariable("deviseCode", deviseCodeLocal);

            // Build a safe `deviseLabel` for templates. Treat "#" as a placeholder (absent symbol) and prefer the ISO code when symbol is not usable.
            String labelSuffix;
            try {
                if (deviseSymboleLocal == null || "#".equals(deviseSymboleLocal.trim()) || deviseSymboleLocal.trim().length() == 0) {
                    // no usable symbol -> use code (if any) or a sensible default
                    labelSuffix = (deviseCodeLocal != null && deviseCodeLocal.trim().length() > 0) ? deviseCodeLocal.trim().toUpperCase() : "FCFA";
                } else {
                    // usable symbol present
                    String s = deviseSymboleLocal.trim();
                    if (!s.matches("[A-Za-z0-9]{1,4}") && deviseCodeLocal != null && deviseCodeLocal.trim().length() > 0) {
                        // non-alphanumeric symbol (e.g. ₵) — append ISO code to help viewers that can't render glyphs
                        labelSuffix = s + " (" + deviseCodeLocal.trim().toUpperCase() + ")";
                    } else {
                        // short alphanumeric symbol or single glyph — show as-is
                        labelSuffix = s;
                    }
                }
            } catch (Exception __e) {
                labelSuffix = (deviseCodeLocal != null ? deviseCodeLocal : "FCFA");
            }
            ctx.setVariable("deviseLabel", labelSuffix);

            java.text.NumberFormat nf = java.text.NumberFormat.getIntegerInstance(java.util.Locale.FRANCE);
            try {
                // ensure vente totals exist
                long montantTotalVal = vente.getMontantTotal() != null ? vente.getMontantTotal() : 0L;
                long remiseVal = vente.getRemise() != null ? vente.getRemise() : 0L;
                long netAPayerVal = vente.getNetAPayer() != null ? vente.getNetAPayer() : montantTotalVal;
                long montantRecuVal = vente.getMontantRecu() != null ? vente.getMontantRecu() : 0L;
                long monnaieRembourseVal = vente.getMonnaieRembourse() != null ? vente.getMonnaieRembourse() : 0L;

                // Reçu revendeur : si au moins une ligne a un prix revendeur, le reçu affiche le TOTAL
                // en prix revendeur (somme des prix revendeur, sans remise). Les valeurs réelles en base
                // (caisse, net à payer réel) ne sont PAS modifiées : seul l'affichage du reçu change.
                try {
                    long revendeurTotal = 0L; boolean hasRevendeur = false;
                    for (com.smboutique.api.model.LigneVente lvx : ligneVenteService.findAll()) {
                        if (lvx.getVente() == null || lvx.getVente().getId() == null || !lvx.getVente().getId().equals(venteId)) continue;
                        int qx = lvx.getQuantite() != null ? lvx.getQuantite() : 0;
                        if (lvx.getPrixRevendeur() != null) { hasRevendeur = true; revendeurTotal += (long) lvx.getPrixRevendeur() * qx; }
                        else { revendeurTotal += (long) (lvx.getNewPrice() != null ? lvx.getNewPrice() : 0) * qx; }
                    }
                    if (hasRevendeur) {
                        montantTotalVal = revendeurTotal;
                        remiseVal = 0L;
                        netAPayerVal = revendeurTotal;
                        montantRecuVal = revendeurTotal;
                        monnaieRembourseVal = 0L;
                    }
                } catch (Exception __e) { /* fallback: totaux réels */ }

                ctx.setVariable("venteMontantTotalLabel", nf.format(montantTotalVal) + " " + labelSuffix);
                ctx.setVariable("venteRemiseLabel", nf.format(remiseVal) + " " + labelSuffix);
                ctx.setVariable("venteNetAPayerLabel", nf.format(netAPayerVal) + " " + labelSuffix);
                ctx.setVariable("venteMontantRecuLabel", nf.format(montantRecuVal) + " " + labelSuffix);
                ctx.setVariable("venteMonnaieRembourseLabel", nf.format(monnaieRembourseVal) + " " + labelSuffix);

                // Enrich lignes maps if present
                try {
                    if (ctx.getVariable("lignes") instanceof java.util.List) {
                        java.util.List<java.util.Map<String,Object>> s = (java.util.List<java.util.Map<String,Object>>) ctx.getVariable("lignes");
                        for (java.util.Map<String,Object> m : s) {
                            try {
                                Number priceN = null;
                                if (m.get("newPrice") instanceof Number) priceN = (Number) m.get("newPrice");
                                else if (m.get("prix") instanceof Number) priceN = (Number) m.get("prix");
                                long priceL = priceN != null ? priceN.longValue() : 0L;
                                // If sale was issued by conditionnement, show price per conditionnement in PDF (e.g. 9 000 / carton)
                                Integer qCondForLabel = null;
                                try { if (m.get("quantiteConditionnement") instanceof Number) qCondForLabel = ((Number)m.get("quantiteConditionnement")).intValue(); } catch (Exception __e) { qCondForLabel = null; }
                                Integer mulForLabel = null;
                                try {
                                    if (m.get("produit") instanceof java.util.Map) {
                                        Object mv = ((java.util.Map<?,?>)m.get("produit")).get("nombreUnitesParConditionnement");
                                        if (mv instanceof Number) mulForLabel = ((Number)mv).intValue();
                                    }
                                } catch (Exception __e) { mulForLabel = null; }
                                Integer qtyForLabel = null;
                                try { if (m.get("quantite") instanceof Number) qtyForLabel = ((Number)m.get("quantite")).intValue(); } catch (Exception __e) { qtyForLabel = null; }
                                boolean pureCondForPrice = qCondForLabel != null && qCondForLabel > 0 && mulForLabel != null && mulForLabel > 1 && qtyForLabel != null && qtyForLabel.equals(qCondForLabel * mulForLabel);
                                if (pureCondForPrice) {
                                    int mulForPrice = mulForLabel != null ? mulForLabel : 1;
                                    long displayPrice = priceL * (long) mulForPrice;
                                    String unitLbl = null;
                                    try { Object um = ((java.util.Map<?,?>)m.get("produit")).get("unite"); if (um instanceof java.util.Map) unitLbl = (String) ((java.util.Map<?,?>)um).get("libelle"); } catch (Exception __e) { unitLbl = null; }
                                    m.put("prixLabel", nf.format(displayPrice) + " " + labelSuffix + " / " + (unitLbl != null ? unitLbl : "carton"));
                                } else {
                                    m.put("prixLabel", nf.format(priceL) + " " + labelSuffix);
                                }
                                Number montantN = m.get("montant") instanceof Number ? (Number) m.get("montant") : null;
                                long montantL = montantN != null ? montantN.longValue() : 0L;
                                m.put("montantLabel", nf.format(montantL) + " " + labelSuffix);
                            } catch (Exception ignore) {}
                        }
                    }
                } catch (Exception ignore) {}
            } catch (Exception ignore) {}

            // Use the vente_espece template (same header/disposition as other receipts and matching the "aperçu" view)
            String html = templateEngine.process("vente_espece", ctx);
            try {
                // write debug HTML for troubleshooting PDF rendering
                try { java.nio.file.Files.write(java.nio.file.Paths.get("/tmp/vente_" + venteId + "_debug.html"), html.getBytes(java.nio.charset.StandardCharsets.UTF_8)); } catch (Exception e) { /* ignore */ }
            } catch (Exception e) { /* ignore */ }
            try (java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream()) {
                PdfRendererBuilder builder = new PdfRendererBuilder();
                builder.useFastMode();
                builder.withHtmlContent(html, null);
                builder.toStream(baos);
                builder.run();
                byte[] pdfBytes = baos.toByteArray();
                response.setContentType("application/pdf");
                response.setHeader("Content-Disposition", "attachment; filename=vente_" + venteId + ".pdf");
                response.getOutputStream().write(pdfBytes);
            }
        } catch (Exception e) {
            log.error("writeVentePdf error for id={} by {} : {}", venteId, currentUser, e.getMessage(), e);
            throw new IOException(e.getMessage());
        }
        log.info("writeVentePdf finished for id={} by {}", venteId, currentUser);
    }

    @Override
    public void writePaiementPdf(Long paiementId, HttpServletResponse response) throws IOException {
        com.smboutique.api.model.Paiement paiement = null;
        try {
            paiement = paiementService.findById(paiementId).orElse(null);
        } catch (Exception e) {
            // ignore
        }
        if (paiement == null) {
            response.sendError(404, "Paiement not found");
            return;
        }

        response.setContentType("application/pdf");
        response.setHeader("Content-Disposition", "attachment; filename=paiement_" + paiementId + ".pdf");

        try {
            ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
            templateResolver.setPrefix("/templates/");
            templateResolver.setSuffix(".html");
            templateResolver.setTemplateMode("HTML");
            templateResolver.setCharacterEncoding("UTF-8");
            TemplateEngine templateEngine = new TemplateEngine();
            templateEngine.setTemplateResolver(templateResolver);

            Context ctx = new Context();
            ctx.setVariable("paiement", paiement);

            // Prepare boutique logo (if any)
            String logoData = null;
            try {
                if (paiement.getCommandeFournisseur() != null && paiement.getCommandeFournisseur().getBoutique() != null && paiement.getCommandeFournisseur().getBoutique().getLogo() != null) {
                    String logoPath = paiement.getCommandeFournisseur().getBoutique().getLogo().startsWith("/") ? paiement.getCommandeFournisseur().getBoutique().getLogo().substring(1) : paiement.getCommandeFournisseur().getBoutique().getLogo();
                    java.io.File f = new java.io.File(logoPath);
                    if (f.exists()) {
                        byte[] b = java.nio.file.Files.readAllBytes(f.toPath());
                        String base64 = java.util.Base64.getEncoder().encodeToString(b);
                        logoData = "data:image/png;base64," + base64;
                    }
                }
            } catch (Exception ex) {
                // ignore
            }
            ctx.setVariable("logoBase64", logoData);
            applyCachetSignature(ctx, paiement.getCommandeFournisseur() != null ? paiement.getCommandeFournisseur().getBoutique() : null);

            // Format date using stored LocalDateTime (no timezone conversion) and include seconds for consistency
            try {
                if (paiement.getDatePaie() != null) {
                    java.time.format.DateTimeFormatter dtf = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
                    String formattedDate = paiement.getDatePaie().format(dtf);
                    ctx.setVariable("datePaiementFormatted", formattedDate);
                } else {
                    ctx.setVariable("datePaiementFormatted", "");
                }
            } catch (Exception e) {
                ctx.setVariable("datePaiementFormatted", "");
            }

            // Compute useful amounts for the receipt
            try {
                Integer montantTotal = 0;
                Integer montantPayeCommande = 0;
                Integer montantPayeThis = paiement.getMontantPaye() != null ? paiement.getMontantPaye() : 0;
                if (paiement.getCommandeFournisseur() != null) {
                    if (paiement.getCommandeFournisseur().getTotal() != null) {
                        montantTotal = paiement.getCommandeFournisseur().getTotal();
                    }
                    // Compute cumulative payments up to and including this payment
                    try {
                        java.util.List<com.smboutique.api.model.Paiement> paiements = paiementService.findByCommandeFournisseurId(paiement.getCommandeFournisseur().getId());
                        if (paiements != null) {
                            // Sort by datePaie asc then id asc to have a deterministic order (prevents including future payments with same timestamp)
                            paiements.sort(java.util.Comparator.comparing(com.smboutique.api.model.Paiement::getDatePaie, java.util.Comparator.nullsFirst(java.util.Comparator.naturalOrder()))
                                    .thenComparing(com.smboutique.api.model.Paiement::getId, java.util.Comparator.nullsFirst(java.util.Comparator.naturalOrder())));
                            int cum = 0;
                            for (com.smboutique.api.model.Paiement p : paiements) {
                                cum += p.getMontantPaye() != null ? p.getMontantPaye() : 0;
                                // include payments up to and including the current payment (by id)
                                if (p.getId() != null && p.getId().equals(paiement.getId())) {
                                    break;
                                }
                            }
                            montantPayeCommande = cum;
                        }
                    } catch (Exception ex) {
                        // Fallback to commande.paie if anything fails
                        if (paiement.getCommandeFournisseur().getPaie() != null) montantPayeCommande = paiement.getCommandeFournisseur().getPaie();
                    }
                }
                Integer montantRestant = Math.max(montantTotal - montantPayeCommande, 0);
                ctx.setVariable("montantTotal", montantTotal);
                ctx.setVariable("montantPayeCommande", montantPayeCommande);
                ctx.setVariable("montantPayeThis", montantPayeThis);
                ctx.setVariable("montantRestant", montantRestant);

                // Safe boutique fields and currency symbol
                String boutiqueNom = "";
                String boutiqueTelephone = "";
                String boutiqueAdresse = "";
                String deviseSymbole = "FCFA";
                try {
                    if (paiement.getCommandeFournisseur() != null && paiement.getCommandeFournisseur().getBoutique() != null) {
                        com.smboutique.api.model.Boutique b = paiement.getCommandeFournisseur().getBoutique();
                        if (b.getNom() != null) boutiqueNom = b.getNom();
                        if (b.getTelephoneLocal() != null) boutiqueTelephone = b.getTelephoneLocal();
                        if (b.getAdresse() != null) boutiqueAdresse = b.getAdresse();
                        try {
                            if (b.getPays() != null && b.getPays().getDeviseSymbole() != null) deviseSymbole = b.getPays().getDeviseSymbole();
                        } catch (Exception ignore) {}
                    }
                } catch (Exception ignore) {}
                ctx.setVariable("boutiqueNom", boutiqueNom);
                ctx.setVariable("boutiqueTelephone", boutiqueTelephone);
                ctx.setVariable("boutiqueAdresse", boutiqueAdresse);
                ctx.setVariable("deviseSymbole", deviseSymbole);

                // Preformatted labels to avoid inline OGNL expressions
                try {
                    java.text.NumberFormat nf = java.text.NumberFormat.getIntegerInstance(java.util.Locale.FRENCH);
                    String totalLabel = nf.format(montantTotal) + " " + deviseSymbole;
                    String payeLabel = nf.format(montantPayeCommande) + " " + deviseSymbole;
                    String restantLabel = nf.format(montantRestant) + " " + deviseSymbole;
                    String payeThisLabel = nf.format(montantPayeThis) + " " + deviseSymbole;
                    ctx.setVariable("montantTotalLabel", totalLabel);
                    ctx.setVariable("montantPayeCommandeLabel", payeLabel);
                    ctx.setVariable("montantRestantLabel", restantLabel);
                    ctx.setVariable("montantPayeThisLabel", payeThisLabel);
                } catch (Exception ignore) {
                    ctx.setVariable("montantTotalLabel", (montantTotal != null ? montantTotal : 0) + " " + deviseSymbole);
                    ctx.setVariable("montantPayeCommandeLabel", (montantPayeCommande != null ? montantPayeCommande : 0) + " " + deviseSymbole);
                    ctx.setVariable("montantRestantLabel", (montantRestant != null ? montantRestant : 0) + " " + deviseSymbole);
                    ctx.setVariable("montantPayeThisLabel", (montantPayeThis != null ? montantPayeThis : 0) + " " + deviseSymbole);
                }

                // Safe payment 'par' label
                String paiementPar = "";
                try {
                    if (paiement.getCommandeFournisseur() != null && paiement.getCommandeFournisseur().getUtilisateur() != null) {
                        com.smboutique.api.model.Utilisateur u = paiement.getCommandeFournisseur().getUtilisateur();
                        paiementPar = (u.getNom() != null ? u.getNom() : "") + (u.getPrenom() != null && !u.getPrenom().isEmpty() ? " " + u.getPrenom() : "");
                    }
                } catch (Exception ignore) {}
                ctx.setVariable("paiementPar", paiementPar);
            } catch (Exception ex) {
                // ignore
            }

            String html = templateEngine.process("paiement_pdf", ctx);
            try (java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream()) {
                PdfRendererBuilder builder = new PdfRendererBuilder();
                builder.useFastMode();
                builder.withHtmlContent(html, null);
                builder.toStream(baos);
                builder.run();
                byte[] pdfBytes = baos.toByteArray();
                response.getOutputStream().write(pdfBytes);
            }
        } catch (Exception e) {
            throw new IOException(e.getMessage());
        }
    }

    @Override
    public void writePaiementClientPdf(Long paiementId, HttpServletResponse response) throws IOException {
        com.smboutique.api.model.PaiementClient paiement = null;
        try {
            paiement = paiementClientService.findById(paiementId).orElse(null);
        } catch (Exception e) {
            // ignore
        }
        if (paiement == null) {
            response.sendError(404, "Paiement client not found");
            return;
        }

        response.setContentType("application/pdf");
        response.setHeader("Content-Disposition", "attachment; filename=paiement_client_" + paiementId + ".pdf");

        try {
            ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
            templateResolver.setPrefix("/templates/");
            templateResolver.setSuffix(".html");
            templateResolver.setTemplateMode("HTML");
            templateResolver.setCharacterEncoding("UTF-8");
            TemplateEngine templateEngine = new TemplateEngine();
            templateEngine.setTemplateResolver(templateResolver);

            Context ctx = new Context();
            ctx.setVariable("paiement", paiement);

            // boutique info for footer/display
            com.smboutique.api.model.Boutique b = null;
            try { if (paiement.getCommandeClient() != null) b = paiement.getCommandeClient().getBoutique(); } catch (Exception _e) { b = null; }
            if (b != null) {
                ctx.setVariable("boutiqueNom", b.getNom() != null ? b.getNom() : "");
                ctx.setVariable("boutiqueTelephone", b.getTelephoneLocal() != null ? b.getTelephoneLocal() : "");
                ctx.setVariable("boutiqueAdresse", b.getAdresse() != null ? b.getAdresse() : "");
                String deviseSymbole = "FCFA";
                try { if (b.getPays() != null && b.getPays().getDeviseSymbole() != null) deviseSymbole = b.getPays().getDeviseSymbole(); } catch (Exception __e) {}
                ctx.setVariable("deviseSymbole", deviseSymbole);
            } else {
                ctx.setVariable("boutiqueNom", "");
                ctx.setVariable("boutiqueTelephone", "");
                ctx.setVariable("boutiqueAdresse", "");
                ctx.setVariable("deviseSymbole", "FCFA");
            }

            String logoData = null;
            try {
                if (paiement.getCommandeClient() != null && paiement.getCommandeClient().getBoutique() != null && paiement.getCommandeClient().getBoutique().getLogo() != null) {
                    String logoPath = paiement.getCommandeClient().getBoutique().getLogo().startsWith("/") ? paiement.getCommandeClient().getBoutique().getLogo().substring(1) : paiement.getCommandeClient().getBoutique().getLogo();
                    java.io.File f = new java.io.File(logoPath);
                    if (f.exists()) {
                        byte[] bArr = java.nio.file.Files.readAllBytes(f.toPath());
                        String base64 = java.util.Base64.getEncoder().encodeToString(bArr);
                        logoData = "data:image/png;base64," + base64;
                    }
                }
            } catch (Exception ex) {
                // ignore
            }
            ctx.setVariable("logoBase64", logoData);
            applyCachetSignature(ctx, paiement.getCommandeClient() != null ? paiement.getCommandeClient().getBoutique() : null);

            try {
                if (paiement.getDatePaie() != null) {
                    java.time.format.DateTimeFormatter dtf = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
                    String formattedDate = paiement.getDatePaie().format(dtf);
                    ctx.setVariable("datePaiementFormatted", formattedDate);
                } else {
                    ctx.setVariable("datePaiementFormatted", "");
                }
            } catch (Exception e) {
                ctx.setVariable("datePaiementFormatted", "");
            }

            // Totals and cumulative payments for the commande client
            try {
                Integer montantTotal = 0;
                Integer montantPayeCommande = 0;
                Integer montantPayeThis = paiement.getMontantPaye() != null ? paiement.getMontantPaye() : 0;
                if (paiement.getCommandeClient() != null) {
                    if (paiement.getCommandeClient().getTotal() != null) {
                        montantTotal = paiement.getCommandeClient().getTotal();
                    }
                    try {
                        // Sum payments for the same commande client (not the whole boutique)
                        if (paiement.getCommandeClient() != null && paiement.getCommandeClient().getId() != null) {
                            java.util.List<com.smboutique.api.model.PaiementClient> paies = paiementClientService.findByCommandeClientId(paiement.getCommandeClient().getId());
                            if (paies != null) {
                                paies.sort(java.util.Comparator.comparing(com.smboutique.api.model.PaiementClient::getDatePaie, java.util.Comparator.nullsFirst(java.util.Comparator.naturalOrder())).thenComparing(com.smboutique.api.model.PaiementClient::getId, java.util.Comparator.nullsFirst(java.util.Comparator.naturalOrder())));
                                int cum = 0;
                                for (com.smboutique.api.model.PaiementClient p : paies) {
                                    cum += p.getMontantPaye() != null ? p.getMontantPaye() : 0;
                                    if (p.getId() != null && p.getId().equals(paiement.getId())) break;
                                }
                                montantPayeCommande = cum;
                            }
                        } else {
                            // fallback to commande.paie if association missing
                            if (paiement.getCommandeClient() != null && paiement.getCommandeClient().getPaie() != null) montantPayeCommande = paiement.getCommandeClient().getPaie();
                        }
                    } catch (Exception ex) {
                        if (paiement.getCommandeClient().getPaie() != null) montantPayeCommande = paiement.getCommandeClient().getPaie();
                    }
                }
                Integer montantRestant = Math.max(montantTotal - montantPayeCommande, 0);
                ctx.setVariable("montantTotal", montantTotal);
                ctx.setVariable("montantPayeCommande", montantPayeCommande);
                ctx.setVariable("montantPayeThis", montantPayeThis);
                ctx.setVariable("montantRestant", montantRestant);

                try {
                    java.text.NumberFormat nf = java.text.NumberFormat.getIntegerInstance(java.util.Locale.FRENCH);
                    String ds = ctx.getVariable("deviseSymbole") != null ? String.valueOf(ctx.getVariable("deviseSymbole")) : "FCFA";
                    ds = sanitizeCurrencySymbol(ds);
                    ctx.setVariable("deviseSymbole", ds);
                    ctx.setVariable("montantTotalLabel", nf.format(montantTotal) + " " + ds);
                    ctx.setVariable("montantPayeCommandeLabel", nf.format(montantPayeCommande) + " " + ds);
                    ctx.setVariable("montantRestantLabel", nf.format(montantRestant) + " " + ds);
                    ctx.setVariable("montantPayeThisLabel", nf.format(montantPayeThis) + " " + ds);
                } catch (Exception ignore) {
                    String ds = ctx.getVariable("deviseSymbole") != null ? String.valueOf(ctx.getVariable("deviseSymbole")) : "FCFA";
                    ds = sanitizeCurrencySymbol(ds);
                    ctx.setVariable("deviseSymbole", ds);
                    ctx.setVariable("montantTotalLabel", (montantTotal != null ? montantTotal : 0) + " " + ds);
                    ctx.setVariable("montantPayeCommandeLabel", (montantPayeCommande != null ? montantPayeCommande : 0) + " " + ds);
                    ctx.setVariable("montantRestantLabel", (montantRestant != null ? montantRestant : 0) + " " + ds);
                    ctx.setVariable("montantPayeThisLabel", (montantPayeThis != null ? montantPayeThis : 0) + " " + ds);
                }
            } catch (Exception ex) {}

            String html = templateEngine.process("paiement_client_pdf", ctx);
            // write debug HTML for inspection and log result
            try {
                java.nio.file.Path debugPath = java.nio.file.Paths.get("/tmp/paiement_" + paiementId + "_debug.html");
                java.nio.file.Files.write(debugPath, html.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                logger.debug("wrote {} , length={}", debugPath.toString(), java.nio.file.Files.size(debugPath));
            } catch (Exception e) {
                logger.warn("failed to write paiement debug html: {}", e.getMessage());
            }
            try (java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream()) {
                PdfRendererBuilder builder = new PdfRendererBuilder();
                builder.useFastMode();
                builder.withHtmlContent(html, null);
                builder.toStream(baos);
                builder.run();
                byte[] pdfBytes = baos.toByteArray();
                response.getOutputStream().write(pdfBytes);
            }
        } catch (Exception e) {
            throw new IOException(e.getMessage());
        }
    }

    @Override
    public void writeLivraisonPdf(Long livraisonId, HttpServletResponse response) throws IOException {
        com.smboutique.api.model.Livraison livraison = null;
        try {
            livraison = livraisonService.findById(livraisonId).orElse(null);
        } catch (Exception e) {
            // ignore
        }
        if (livraison == null) {
            response.sendError(404, "Livraison not found");
            return;
        }

        response.setContentType("application/pdf");
        response.setHeader("Content-Disposition", "attachment; filename=livraison_" + livraisonId + ".pdf");

        try {
            ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
            templateResolver.setPrefix("/templates/");
            templateResolver.setSuffix(".html");
            templateResolver.setTemplateMode("HTML");
            templateResolver.setCharacterEncoding("UTF-8");
            TemplateEngine templateEngine = new TemplateEngine();
            templateEngine.setTemplateResolver(templateResolver);

            Context ctx = new Context();
            ctx.setVariable("livraison", livraison);

            // boutique info for footer/display
            com.smboutique.api.model.Boutique b = null;
            try { if (livraison.getCommandeClient() != null) b = livraison.getCommandeClient().getBoutique(); } catch (Exception _e) { b = null; }
            if (b != null) {
                ctx.setVariable("boutiqueNom", b.getNom() != null ? b.getNom() : "");
                ctx.setVariable("boutiqueTelephone", b.getTelephoneLocal() != null ? b.getTelephoneLocal() : "");
                ctx.setVariable("boutiqueAdresse", b.getAdresse() != null ? b.getAdresse() : "");
                String deviseSymbole = "FCFA";
                try { if (b.getPays() != null && b.getPays().getDeviseSymbole() != null) deviseSymbole = b.getPays().getDeviseSymbole(); } catch (Exception __e) {}
                ctx.setVariable("deviseSymbole", deviseSymbole);
            } else {
                ctx.setVariable("boutiqueNom", "");
                ctx.setVariable("boutiqueTelephone", "");
                ctx.setVariable("boutiqueAdresse", "");
                ctx.setVariable("deviseSymbole", "FCFA");
            }

            // Prepare boutique logo (if any) similar to other templates
            String logoData = null;
            try {
                if (livraison.getCommandeClient() != null && livraison.getCommandeClient().getBoutique() != null && livraison.getCommandeClient().getBoutique().getLogo() != null) {
                    String logoPath = livraison.getCommandeClient().getBoutique().getLogo().startsWith("/") ? livraison.getCommandeClient().getBoutique().getLogo().substring(1) : livraison.getCommandeClient().getBoutique().getLogo();
                    java.io.File f = new java.io.File(logoPath);
                    if (f.exists()) {
                        byte[] bArr = java.nio.file.Files.readAllBytes(f.toPath());
                        String base64 = java.util.Base64.getEncoder().encodeToString(bArr);
                        logoData = "data:image/png;base64," + base64;
                    }
                }
            } catch (Exception ex) {
                // ignore
            }
            ctx.setVariable("logoBase64", logoData);
            applyCachetSignature(ctx, livraison.getCommandeClient() != null ? livraison.getCommandeClient().getBoutique() : null);

            // Format date
            try {
                if (livraison.getDateLivraison() != null) {
                    java.time.format.DateTimeFormatter dtf = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
                    String formattedDate = livraison.getDateLivraison().format(dtf);
                    ctx.setVariable("dateLivraisonFormatted", formattedDate);
                } else {
                    ctx.setVariable("dateLivraisonFormatted", "");
                }
            } catch (Exception e) { ctx.setVariable("dateLivraisonFormatted", ""); }

            // Fetch lines for this livraison and normalize fields expected by template
            java.util.List<com.smboutique.api.model.LigneLivraison> lignes = ligneLivraisonService.findByLivraisonId(livraison.getId());
            java.util.List<java.util.Map<String, Object>> lignesView = new java.util.ArrayList<>();
            if (lignes != null) {
                for (com.smboutique.api.model.LigneLivraison ll : lignes) {
                    java.util.Map<String, Object> m = new java.util.HashMap<>();
                    m.put("designation", ll.getProduit() != null ? ll.getProduit().getNomProduit() : "Produit");
                    // try to include original ordered quantity if possible
                    Integer qteCommande = 0;
                    Integer qteCommandeCond = null;
                    String uniteLibelle = null;
                    String uniteConditionnementLibelle = null;
                    Integer nombreUnitesParConditionnement = null;
                    // Prefer the emballage actually recorded on this delivery line — it mirrors
                    // whichever emballage the originating order line used, and is authoritative
                    // over the product's flat "default" fields when the product has 2+ options.
                    com.smboutique.api.model.ProduitEmballage llEmballage = null;
                    try { llEmballage = ll.getEmballage(); } catch (Exception ex) { llEmballage = null; }
                    if (llEmballage != null) {
                        nombreUnitesParConditionnement = llEmballage.getNombreUnites();
                        uniteLibelle = llEmballage.getUnite() != null ? llEmballage.getUnite().getLibelle() : null;
                        uniteConditionnementLibelle = uniteLibelle;
                    }
                    try {
                        if (livraison.getCommandeClient() != null && livraison.getCommandeClient().getLignes() != null) {
                            for (com.smboutique.api.model.LigneCommandeClient lcc : livraison.getCommandeClient().getLignes()) {
                                if (lcc.getProduit() != null && ll.getProduit() != null && lcc.getProduit().getId() != null && lcc.getProduit().getId().equals(ll.getProduit().getId())) {
                                    qteCommande = lcc.getQuantite() != null ? lcc.getQuantite() : 0;
                                    qteCommandeCond = lcc.getQuantiteConditionnement();
                                    // if product info is richer on the commande side, use it to extract unit libelle and multiplicateur
                                    // (only when no emballage was recorded on the delivery line itself)
                                    if (llEmballage == null) {
                                        try {
                                            if (lcc.getProduit() != null && lcc.getProduit().getUnite() != null) {
                                                uniteLibelle = lcc.getProduit().getUnite().getLibelle();
                                            }
                                            if (lcc.getProduit() != null) {
                                                uniteConditionnementLibelle = lcc.getProduit().getUniteConditionnement();
                                            }
                                        } catch (Exception ex) { /* ignore */ }
                                        try {
                                            if (lcc.getProduit() != null && lcc.getProduit().getNombreUnitesParConditionnement() != null) {
                                                nombreUnitesParConditionnement = lcc.getProduit().getNombreUnitesParConditionnement();
                                            }
                                        } catch (Exception ex) { /* ignore */ }
                                    }
                                    break;
                                }
                            }
                        }
                    } catch (Exception e) {}
                    Integer qteLivree = ll.getQuantiteRecu() != null ? ll.getQuantiteRecu() : 0;
                    // If not found on the commande line, try product on the livraison line itself
                    try {
                        if (uniteLibelle == null && ll.getProduit() != null && ll.getProduit().getUnite() != null) {
                            uniteLibelle = ll.getProduit().getUnite().getLibelle();
                        }
                        if (uniteConditionnementLibelle == null && ll.getProduit() != null) {
                            uniteConditionnementLibelle = ll.getProduit().getUniteConditionnement();
                        }
                    } catch (Exception e) { /* ignore */ }
                    try {
                        if (nombreUnitesParConditionnement == null && ll.getProduit() != null && ll.getProduit().getNombreUnitesParConditionnement() != null) {
                            nombreUnitesParConditionnement = ll.getProduit().getNombreUnitesParConditionnement();
                        }
                    } catch (Exception e) { /* ignore */ }
                    // As a last resort, lookup the product directly from the repository to retrieve the unit info
                    try {
                        Long pid = (ll.getProduit() != null && ll.getProduit().getId() != null) ? ll.getProduit().getId() : null;
                        if ((uniteLibelle == null || nombreUnitesParConditionnement == null || uniteConditionnementLibelle == null) && pid != null) {
                            com.smboutique.api.model.Produit p = produitRepository.findById(pid).orElse(null);
                            if (p != null) {
                                if (uniteLibelle == null && p.getUnite() != null) uniteLibelle = p.getUnite().getLibelle();
                                if (uniteConditionnementLibelle == null) uniteConditionnementLibelle = p.getUniteConditionnement();
                                if (nombreUnitesParConditionnement == null && p.getNombreUnitesParConditionnement() != null) nombreUnitesParConditionnement = p.getNombreUnitesParConditionnement();
                            }
                        }
                    } catch (Exception e) { /* ignore */ }

                    // Cartons/conditionnement quantities must use the produit's own "unité de
                    // conditionnement" label, not its base unit label — they are two distinct fields.
                    String unitLabelToUse = (uniteConditionnementLibelle != null && !uniteConditionnementLibelle.isBlank()) ? uniteConditionnementLibelle : (uniteLibelle != null ? uniteLibelle : "carton");

                    m.put("qteCommande", qteCommande);
                    m.put("qteLivreeThis", qteLivree);
                    m.put("qteRestante", Math.max(0, qteCommande - qteLivree));
                    // Exposed to the template specifically alongside cartons quantities, so it must
                    // carry the conditionnement label, not the base unit label.
                    m.put("uniteLibelle", unitLabelToUse);
                    m.put("nombreUnitesParConditionnement", nombreUnitesParConditionnement);
                    boolean orderedInConditionnement = qteCommandeCond != null && qteCommandeCond > 0;
                    try {
                        if (orderedInConditionnement) {
                            m.put("qteCommandeLabel", String.format("%d %s", qteCommandeCond, unitLabelToUse));
                        } else {
                            m.put("qteCommandeLabel", String.format("%d U", qteCommande));
                        }
                    } catch (Exception ex) {
                        if (orderedInConditionnement) m.put("qteCommandeLabel", String.format("%d %s", qteCommandeCond, unitLabelToUse));
                        else m.put("qteCommandeLabel", String.format("%d U", qteCommande));
                    }
                    try {
                        if (orderedInConditionnement && nombreUnitesParConditionnement != null && nombreUnitesParConditionnement > 0 && (qteLivree % nombreUnitesParConditionnement == 0)) {
                            m.put("qteLivreeLabel", String.format("%d %s", (qteLivree / nombreUnitesParConditionnement), unitLabelToUse));
                        } else {
                            m.put("qteLivreeLabel", String.format("%d U", qteLivree));
                        }
                    } catch (Exception ex) {
                        if (orderedInConditionnement && nombreUnitesParConditionnement != null && nombreUnitesParConditionnement > 0 && (qteLivree % nombreUnitesParConditionnement == 0)) {
                            m.put("qteLivreeLabel", String.format("%d %s", (qteLivree / nombreUnitesParConditionnement), unitLabelToUse));
                        } else {
                            m.put("qteLivreeLabel", String.format("%d U", qteLivree));
                        }
                    }
                    // ensure a stock->produit->unite.libelle path is available for template fallbacks
                    // (kept consistent with the conditionnement label used above)
                    try {
                        java.util.Map<String,Object> prodMap = new java.util.HashMap<>();
                        if (unitLabelToUse != null) prodMap.put("unite", java.util.Map.of("libelle", unitLabelToUse));
                        if (nombreUnitesParConditionnement != null) prodMap.put("nombreUnitesParConditionnement", nombreUnitesParConditionnement);
                        if (!prodMap.isEmpty()) {
                            java.util.Map<String,Object> stockMap = new java.util.HashMap<>();
                            stockMap.put("produit", prodMap);
                            m.put("stock", stockMap);
                        }
                    } catch (Exception ex) { /* ignore */ }
                    // debug log values collected for this ligne
                    try {
                        logger.info("livraison ligne debug: produitId={}, qteCommande={}, uniteLibelle={}, nombreUnitesParConditionnement={}", (ll.getProduit()!=null && ll.getProduit().getId()!=null?ll.getProduit().getId():"null"), qteCommande, uniteLibelle, nombreUnitesParConditionnement);
                    } catch (Exception ex) { /* ignore */ }
                    lignesView.add(m);
                }
            }
            ctx.setVariable("lignesView", lignesView);
            // Debug: persist lignesView as JSON for inspection
            try {
                String j = new com.fasterxml.jackson.databind.ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(lignesView);
                java.nio.file.Files.write(java.nio.file.Paths.get("/tmp/livraison_" + livraisonId + "_lines.json"), j.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                for (java.util.Map<String,Object> mm : lignesView) {
                    sb.append(mm.toString()).append("\n");
                }
                java.nio.file.Files.write(java.nio.file.Paths.get("/tmp/livraison_" + livraisonId + "_lines.txt"), sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            } catch (Exception ex) { /* ignore */ }

            String html = templateEngine.process("livraison_pdf", ctx);
            try {
                java.nio.file.Files.write(java.nio.file.Paths.get("/tmp/livraison_" + livraisonId + "_debug.html"), html.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            } catch (Exception ex) { /* ignore */ }
            try (java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream()) {
                PdfRendererBuilder builder = new PdfRendererBuilder();
                builder.useFastMode();
                builder.withHtmlContent(html, null);
                builder.toStream(baos);
                builder.run();
                byte[] pdfBytes = baos.toByteArray();
                response.getOutputStream().write(pdfBytes);
            }
        } catch (Exception e) {
            throw new IOException(e.getMessage());
        }
    }
}
