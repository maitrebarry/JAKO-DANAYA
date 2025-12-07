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

            // Document handled by renderer (HTML->PDF)
        } catch (Exception e) {
            throw new IOException(e.getMessage());
        }
    }
}
