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
            response.sendError(404, "Commande not found");
            return;
        }

        response.setContentType("application/pdf");
        response.setHeader("Content-Disposition", "attachment; filename=commande_" + commandeId + ".pdf");

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

            String html = templateEngine.process("commande_pdf", ctx);
            // Save rendered HTML for debug (so we can inspect if something goes wrong)
            try {
                java.nio.file.Files.write(java.nio.file.Paths.get("/tmp/commande_" + commandeId + "_debug.html"), html.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            } catch (Exception e) {
                // ignore; non-fatal
            }

            try (java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream()) {
                PdfRendererBuilder builder = new PdfRendererBuilder();
                builder.useFastMode();
                builder.withHtmlContent(html, null);
                builder.toStream(baos);
                builder.run();
                byte[] pdfBytes = baos.toByteArray();
                response.setContentType("application/pdf");
                response.setHeader("Content-Disposition", "attachment; filename=commande_" + commandeId + ".pdf");
                response.getOutputStream().write(pdfBytes);
            }

        } catch (Exception e) {
            log.error("writeCommandePdf error for id={} by {} : {}", commandeId, currentUser, e.getMessage(), e);
            throw new IOException(e.getMessage());
        }
        log.info("writeCommandePdf finished for id={} by {}", commandeId, currentUser);
    }

    @Override
    public void writeReceptionPdf(Long receptionId, HttpServletResponse response) throws IOException {
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

        response.setContentType("application/pdf");
        response.setHeader("Content-Disposition", "attachment; filename=reception_" + receptionId + ".pdf");

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
                // ignore
            }
            ctx.setVariable("logoBase64", logoData);

            // Format date using stored LocalDateTime but normalize to UTC instant for consistent printed time
            try {
                if (reception.getDateReception() != null) {
                    java.time.format.DateTimeFormatter dtf = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
                    java.time.ZonedDateTime z = reception.getDateReception().atZone(java.time.ZoneId.systemDefault()).withZoneSameInstant(java.time.ZoneOffset.UTC);
                    String formattedDate = z.format(dtf);
                    ctx.setVariable("dateReceptionFormatted", formattedDate);
                } else {
                    ctx.setVariable("dateReceptionFormatted", "");
                }
            } catch (Exception e) {
                ctx.setVariable("dateReceptionFormatted", "");
            }

            // Build a view model for table lines so we show per-reception quantities (Qté Reçue) and remaining
            try {
                java.util.List<java.util.Map<String, Object>> lignesView = new java.util.ArrayList<>();
                java.util.List<com.smboutique.api.model.LigneReception> lignesReception = new java.util.ArrayList<>();
                try {
                    lignesReception = ligneReceptionService.findByReceptionId(reception.getId());
                } catch (Exception ex) {
                    // ignore
                }
                // Get all receptions for this commande to be able to compute cumulative received up to each reception
                java.util.List<com.smboutique.api.model.Reception> allRecsForCommande = receptionService.findByCommandeFournisseurId(reception.getCommandeFournisseur().getId());
                for (com.smboutique.api.model.LigneCommande lc : reception.getCommandeFournisseur().getLignes()) {
                    java.util.Map<String, Object> m = new java.util.HashMap<>();
                    String designation = (lc.getStock() != null && lc.getStock().getProduit() != null) ? lc.getStock().getProduit().getNomProduit() : "Produit";
                    Integer qteCommande = lc.getQuantite() != null ? lc.getQuantite() : 0;
                    // Sum quantities received in THIS reception for this product
                    int qteRecueThis = lignesReception.stream()
                            .filter(lr -> lr.getProduit() != null && lr.getProduit().getId() != null && lc.getStock() != null && lc.getStock().getProduit() != null && lr.getProduit().getId().equals(lc.getStock().getProduit().getId()))
                            .mapToInt(com.smboutique.api.model.LigneReception::getQuantiteRecu)
                            .sum();

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
                    try {
                        if (lc.getStock() != null && lc.getStock().getProduit() != null) {
                            nombreUnites = lc.getStock().getProduit().getNombreUnitesParConditionnement();
                            if (lc.getStock().getProduit().getUnite() != null) uniteLibelle = lc.getStock().getProduit().getUnite().getLibelle();
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
                    m.put("uniteConditionnementLibelle", uniteLibelle);
                    m.put("quantiteConditionnementCommande", quantiteConditionnementCommande);
                    m.put("quantiteConditionnementRecueThis", quantiteConditionnementRecueThis);
                    m.put("quantiteConditionnementRestante", quantiteConditionnementRestante);
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
            } catch (Exception e) {
                // ignore non-fatal
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
    public void writeCommandeClientPdf(Long commandeId, HttpServletResponse response) throws IOException {
        // Similar to writeCommandePdf but use CommandeClient
        com.smboutique.api.model.CommandeClient commande = commandeClientService.findById(commandeId).orElse(null);
        if (commande == null) {
            response.sendError(404, "Commande client not found");
            return;
        }

        response.setContentType("application/pdf");
        response.setHeader("Content-Disposition", "attachment; filename=commande_client_" + commandeId + ".pdf");

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

            // Prepare formatted date if needed
            try {
                ctx.setVariable("dateCommandeFormatted", "");
            } catch (Exception e) {}

            // Build a normalized representation of lines so the Thymeleaf template
            // can safely access common properties (designation, stock.produit.*)
            java.util.List<java.util.Map<String,Object>> lignesNorm = new java.util.ArrayList<>();
            try {
                if (commande.getLignes() != null) {
                    for (com.smboutique.api.model.LigneCommandeClient l : commande.getLignes()) {
                        java.util.Map<String,Object> m = new java.util.HashMap<>();
                        m.put("designation", null);
                        m.put("quantiteConditionnement", l.getQuantiteConditionnement());
                        m.put("quantite", l.getQuantite());
                        m.put("price", null);
                        m.put("newPrice", l.getNewPrice());
                        m.put("montant", null);

                        java.util.Map<String,Object> stock = new java.util.HashMap<>();
                        java.util.Map<String,Object> produitMap = new java.util.HashMap<>();
                        if (l.getProduit() != null) {
                            produitMap.put("nomProduit", l.getProduit().getNomProduit());
                            produitMap.put("prixAchat", l.getProduit().getPrixAchat());
                            produitMap.put("nombreUnitesParConditionnement", l.getProduit().getNombreUnitesParConditionnement());
                            if (l.getProduit().getUnite() != null) {
                                java.util.Map<String,Object> uniteMap = new java.util.HashMap<>();
                                uniteMap.put("libelle", l.getProduit().getUnite().getLibelle());
                                produitMap.put("unite", uniteMap);
                            }
                        }
                        stock.put("produit", produitMap);
                        m.put("stock", stock);
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

            // Prepare boutique logo
            String logoData = null;
            com.smboutique.api.model.Boutique b = null;
            try {
                // attempt to get boutique logo from depense if available
                if (dep.getBoutiqueId() != null) {
                    b = boutiqueRepository.findById(dep.getBoutiqueId()).orElse(null);
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
            // expose boutique to template
            if (dep.getBoutiqueId() != null) ctx.setVariable("boutiqueId", dep.getBoutiqueId());
            if (b != null) ctx.setVariable("boutique", b);

            // add creator / validator / annulation names
            String createurNom = "";
            String validatorNom = "";
            String annuleParNom = "";
            String validatedAtFormatted = "";
            String annuleAtFormatted = "";
            try {
                if (dep.getCreateurId() != null) {
                    var cu = utilisateurService.findById(dep.getCreateurId()).orElse(null);
                    if (cu != null) createurNom = (cu.getNom() != null ? cu.getNom() : "") + " " + (cu.getPrenom() != null ? cu.getPrenom() : "");
                }
                if (dep.getValidatorId() != null) {
                    var vu = utilisateurService.findById(dep.getValidatorId()).orElse(null);
                    if (vu != null) validatorNom = (vu.getNom() != null ? vu.getNom() : "") + " " + (vu.getPrenom() != null ? vu.getPrenom() : "");
                    if (dep.getValidatedAt() != null) {
                        java.time.format.DateTimeFormatter dtf = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
                        validatedAtFormatted = dep.getValidatedAt().format(dtf);
                    }
                }
                if (dep.getAnnulePar() != null) {
                    var au = utilisateurService.findById(dep.getAnnulePar()).orElse(null);
                    if (au != null) annuleParNom = (au.getNom() != null ? au.getNom() : "") + " " + (au.getPrenom() != null ? au.getPrenom() : "");
                    if (dep.getAnnuleAt() != null) {
                        java.time.format.DateTimeFormatter dtf2 = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
                        annuleAtFormatted = dep.getAnnuleAt().format(dtf2);
                    }
                }
            } catch (Exception ex) {
                // ignore
            }
            ctx.setVariable("createurNom", createurNom);
            ctx.setVariable("validatorNom", validatorNom);
            ctx.setVariable("annuleParNom", annuleParNom);
            ctx.setVariable("validatedAtFormatted", validatedAtFormatted);
            ctx.setVariable("annuleAtFormatted", annuleAtFormatted);
            ctx.setVariable("annuleReason", dep.getAnnuleReason());

            // format creation date
            try {
                if (dep.getCreatedAt() != null) {
                    java.time.format.DateTimeFormatter dtf = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
                    String formattedDate = dep.getCreatedAt().format(dtf);
                    ctx.setVariable("dateCreatedFormatted", formattedDate);
                } else {
                    ctx.setVariable("dateCreatedFormatted", "");
                }
            } catch (Exception e) { ctx.setVariable("dateCreatedFormatted", ""); }

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

            java.util.List<com.smboutique.api.model.LigneVente> lignes = new java.util.ArrayList<>();
            try {
                lignes = ligneVenteService.findAll();
                lignes.removeIf(lv -> lv.getVente() == null || lv.getVente().getId() == null || !lv.getVente().getId().equals(venteId));
            } catch (Exception e) { /* ignore */ }
            ctx.setVariable("lignes", lignes);

            try {
                if (vente.getDateVente() != null) {
                    java.time.format.DateTimeFormatter dtf = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
                    String formattedDate = vente.getDateVente().format(dtf);
                    ctx.setVariable("dateVenteFormatted", formattedDate);
                } else {
                    ctx.setVariable("dateVenteFormatted", "");
                }
            } catch (Exception e) { ctx.setVariable("dateVenteFormatted", ""); }

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

            String logoData = null;
            try {
                if (paiement.getCommandeClient() != null && paiement.getCommandeClient().getBoutique() != null && paiement.getCommandeClient().getBoutique().getLogo() != null) {
                    String logoPath = paiement.getCommandeClient().getBoutique().getLogo().startsWith("/") ? paiement.getCommandeClient().getBoutique().getLogo().substring(1) : paiement.getCommandeClient().getBoutique().getLogo();
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
            } catch (Exception ex) {}

            String html = templateEngine.process("paiement_client_pdf", ctx);
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

            // Prepare boutique logo (if any) similar to other templates
            String logoData = null;
            try {
                if (livraison.getCommandeClient() != null && livraison.getCommandeClient().getBoutique() != null && livraison.getCommandeClient().getBoutique().getLogo() != null) {
                    String logoPath = livraison.getCommandeClient().getBoutique().getLogo().startsWith("/") ? livraison.getCommandeClient().getBoutique().getLogo().substring(1) : livraison.getCommandeClient().getBoutique().getLogo();
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
                    String uniteLibelle = null;
                    Integer nombreUnitesParConditionnement = null;
                    try {
                        if (livraison.getCommandeClient() != null && livraison.getCommandeClient().getLignes() != null) {
                            for (com.smboutique.api.model.LigneCommandeClient lcc : livraison.getCommandeClient().getLignes()) {
                                if (lcc.getProduit() != null && ll.getProduit() != null && lcc.getProduit().getId() != null && lcc.getProduit().getId().equals(ll.getProduit().getId())) {
                                    qteCommande = lcc.getQuantite() != null ? lcc.getQuantite() : 0;
                                    // if product info is richer on the commande side, use it to extract unit libelle and multiplicateur
                                    try {
                                        if (lcc.getProduit() != null && lcc.getProduit().getUnite() != null) {
                                            uniteLibelle = lcc.getProduit().getUnite().getLibelle();
                                        }
                                    } catch (Exception ex) { /* ignore */ }
                                    try {
                                        if (lcc.getProduit() != null && lcc.getProduit().getNombreUnitesParConditionnement() != null) {
                                            nombreUnitesParConditionnement = lcc.getProduit().getNombreUnitesParConditionnement();
                                        }
                                    } catch (Exception ex) { /* ignore */ }
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
                    } catch (Exception e) { /* ignore */ }
                    try {
                        if (nombreUnitesParConditionnement == null && ll.getProduit() != null && ll.getProduit().getNombreUnitesParConditionnement() != null) {
                            nombreUnitesParConditionnement = ll.getProduit().getNombreUnitesParConditionnement();
                        }
                    } catch (Exception e) { /* ignore */ }
                    // As a last resort, lookup the product directly from the repository to retrieve the unit info
                    try {
                        Long pid = (ll.getProduit() != null && ll.getProduit().getId() != null) ? ll.getProduit().getId() : null;
                        if ((uniteLibelle == null || nombreUnitesParConditionnement == null) && pid != null) {
                            com.smboutique.api.model.Produit p = produitRepository.findById(pid).orElse(null);
                            if (p != null) {
                                if (uniteLibelle == null && p.getUnite() != null) uniteLibelle = p.getUnite().getLibelle();
                                if (nombreUnitesParConditionnement == null && p.getNombreUnitesParConditionnement() != null) nombreUnitesParConditionnement = p.getNombreUnitesParConditionnement();
                            }
                        }
                    } catch (Exception e) { /* ignore */ }

                    m.put("qteCommande", qteCommande);
                    m.put("qteLivreeThis", qteLivree);
                    m.put("qteRestante", Math.max(0, qteCommande - qteLivree));
                    m.put("uniteLibelle", uniteLibelle);
                    m.put("nombreUnitesParConditionnement", nombreUnitesParConditionnement);
                    // Prepare formatted labels to avoid template fallback inconsistencies
                    String unitLabelToUse = uniteLibelle != null ? uniteLibelle : "u";
                    try {
                        m.put("qteCommandeLabel", String.format("%d %s", qteCommande, unitLabelToUse));
                    } catch (Exception ex) { m.put("qteCommandeLabel", String.format("%d %s", qteCommande, unitLabelToUse)); }
                    try {
                        m.put("qteLivreeLabel", String.format("%d %s", qteLivree, unitLabelToUse));
                    } catch (Exception ex) { m.put("qteLivreeLabel", String.format("%d %s", qteLivree, unitLabelToUse)); }
                    // ensure a stock->produit->unite.libelle path is available for template fallbacks
                    try {
                        java.util.Map<String,Object> prodMap = new java.util.HashMap<>();
                        if (uniteLibelle != null) prodMap.put("unite", java.util.Map.of("libelle", uniteLibelle));
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
