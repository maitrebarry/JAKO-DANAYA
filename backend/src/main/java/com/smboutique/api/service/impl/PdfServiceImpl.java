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

    @Override
    public void writeCommandePdf(Long commandeId, HttpServletResponse response) throws IOException {
        CommandeFournisseur commande = commandeFournisseurService.findById(commandeId).orElse(null);
        if (commande == null) {
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
            throw new IOException(e.getMessage());
        }
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

                    m.put("designation", designation);
                    m.put("qteCommande", qteCommande);
                    m.put("qteRecueThis", qteRecueThis);
                    m.put("qteRestante", qteRestante);
                    lignesView.add(m);
                }
                ctx.setVariable("lignesView", lignesView);
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
            if (html != null) html = html.replace("&nbsp;", "&#160;");

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
            throw new IOException(e.getMessage());
        }
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
}
